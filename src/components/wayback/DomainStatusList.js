import { useEffect, useRef, useMemo } from 'react';

const STATUS_COLORS = {
  QUEUED: '#6b7280',
  FETCHING_SNAPSHOTS: '#3b82f6',
  NO_SNAPSHOTS: '#9ca3af',
  UNAVAILABLE: '#ef4444',
  ANALYZING: '#f59e0b',
  ANALYZING_SPAM: '#f59e0b',
  ANALYZING_BACKLINKS: '#8b5cf6',
  ANALYZING_TOPICS: '#ec4899',
  ANALYZING_METRICS: '#06b6d4',
  COMPLETE: '#10b981',
  CLEAN: '#10b981',
  SUSPICIOUS: '#f59e0b',
  SPAM: '#ef4444',
};

const STATUS_LABELS = {
  QUEUED: 'Queued',
  FETCHING_SNAPSHOTS: 'Fetching Snapshots',
  NO_SNAPSHOTS: 'No Snapshots',
  UNAVAILABLE: 'Unavailable',
  ANALYZING: 'Analyzing',
  ANALYZING_SPAM: 'Analyzing Spam',
  ANALYZING_BACKLINKS: 'Analyzing Backlinks',
  ANALYZING_TOPICS: 'Analyzing Topics',
  ANALYZING_METRICS: 'Analyzing Metrics',
  COMPLETE: 'Complete',
  CLEAN: 'Clean',
  SUSPICIOUS: 'Suspicious',
  SPAM: 'Spam',
};

export default function DomainStatusList({ domains, summary }) {
  const containerRef = useRef(null);
  const wasAtBottomRef = useRef(true);
  
  // Validate and filter domains, normalize status to string
  const validDomains = (domains || [])
    .filter(d => 
      d && 
      typeof d === 'object' && 
      d.domain && 
      typeof d.domain === 'string' &&
      d.domain.trim().length > 0
    )
    .map(d => {
      // Ensure status is always a string
      let normalizedStatus = d.status;
      if (typeof normalizedStatus !== 'string') {
        if (normalizedStatus && typeof normalizedStatus === 'object') {
          normalizedStatus = normalizedStatus.status || normalizedStatus.label || 'QUEUED';
        } else {
          normalizedStatus = String(normalizedStatus || 'QUEUED');
        }
      }
      return {
        ...d,
        status: normalizedStatus,
      };
    });

  // Track if user is at bottom, and only auto-scroll if they were
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const threshold = 50; // pixels from bottom
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      
      wasAtBottomRef.current = isAtBottom;
      
      // Only auto-scroll if user was at bottom (not manually scrolled up)
      if (wasAtBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [validDomains]);

  // Calculate summary from domains if not provided
  const computedSummary = useMemo(() => {
    if (summary) return summary;
    
    if (!validDomains || validDomains.length === 0) return null;
    
    return {
      total: validDomains.length,
      clean: validDomains.filter(d => d.status === 'CLEAN').length,
      suspicious: validDomains.filter(d => d.status === 'SUSPICIOUS').length,
      spam: validDomains.filter(d => d.status === 'SPAM').length,
      unavailable: validDomains.filter(d => d.status === 'UNAVAILABLE').length,
      no_snapshots: validDomains.filter(d => d.status === 'NO_SNAPSHOTS').length,
    };
  }, [validDomains, summary]);

  if (!validDomains || validDomains.length === 0) {
    return null;
  }

  const getStatusBadge = (status) => {
    // Normalize status - ensure it's always a string
    let normalizedStatus = 'QUEUED';
    if (typeof status === 'string') {
      normalizedStatus = status;
    } else if (status && typeof status === 'object') {
      // If status is an object, try to extract string value
      normalizedStatus = status.status || status.label || 'QUEUED';
      console.warn('Status is an object, using normalized value:', normalizedStatus, status);
    } else if (status !== null && status !== undefined) {
      normalizedStatus = String(status);
    }
    
    const color = STATUS_COLORS[normalizedStatus] || '#6b7280';
    const label = STATUS_LABELS[normalizedStatus] || normalizedStatus;
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '0.75rem',
          fontWeight: 600,
          backgroundColor: `${color}20`,
          color: color,
          border: `1px solid ${color}40`,
        }}
      >
        {label}
      </span>
    );
  };

  const formatStopWords = (stopWords) => {
    if (!stopWords || stopWords.length === 0) return 'None';
    const words = stopWords.slice(0, 5).map(sw => sw.word || sw);
    const more = stopWords.length > 5 ? ` +${stopWords.length - 5}` : '';
    return words.join(', ') + more;
  };

  return (
    <>
      {/* Summary */}
      {computedSummary && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <header className="card-header">
            <h2>Analysis Summary</h2>
          </header>
          <div style={{ padding: '16px' }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}>
              <span>
                <strong>Total:</strong> {computedSummary.total || 0}
              </span>
              <span style={{ color: '#10b981' }}>
                <strong>Clean:</strong> {computedSummary.clean || 0}
              </span>
              <span style={{ color: '#f59e0b' }}>
                <strong>Suspicious:</strong> {computedSummary.suspicious || 0}
              </span>
              <span style={{ color: '#ef4444' }}>
                <strong>Spam:</strong> {computedSummary.spam || 0}
              </span>
              <span style={{ color: '#9ca3af' }}>
                <strong>No Snapshots:</strong> {computedSummary.no_snapshots || 0}
              </span>
              <span style={{ color: '#ef4444' }}>
                <strong>Unavailable:</strong> {computedSummary.unavailable || 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Domain List */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <header className="card-header">
          <h2>Domain Analysis Status</h2>
        </header>
        <div
          ref={containerRef}
          style={{
            maxHeight: '600px',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '16px',
            boxSizing: 'border-box',
            margin: '0 -24px -24px',
          }}
          onScroll={(e) => {
            // Track if user manually scrolls away from bottom
            const container = e.target;
            const threshold = 50;
            const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
            wasAtBottomRef.current = isAtBottom;
          }}
        >
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px',
            padding: '0 24px 24px',
            boxSizing: 'border-box',
            width: '100%',
          }}>
            {validDomains.map((domain, index) => {
              // Validate domain object structure
              if (!domain || typeof domain !== 'object' || !domain.domain) {
                console.error('Invalid domain object:', domain);
                return null;
              }
              
              return (
              <div
                key={domain.domain || index}
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #374151',
                  backgroundColor: '#1f2937',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '1rem', color: '#f9fafb' }}>{domain.domain}</strong>
                      {getStatusBadge(domain.status)}
                    </div>
                    {domain.lastMessage && typeof domain.lastMessage === 'string' && (
                      <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '4px' }}>
                        {domain.lastMessage}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '12px',
                  fontSize: '0.85rem',
                  marginTop: '12px',
                }}>
                  <div>
                    <span style={{ color: '#9ca3af' }}>Snapshots:</span>{' '}
                    <strong style={{ color: '#f9fafb' }}>
                      {domain.snapshotsAnalyzed || 0}/{domain.snapshotsFound || 0}
                    </strong>
                  </div>
                  {domain.maxSpamScore !== undefined && (
                    <div>
                      <span style={{ color: '#9ca3af' }}>Max Score:</span>{' '}
                      <strong style={{
                        color: domain.maxSpamScore >= 8 ? '#ef4444' : domain.maxSpamScore >= 5 ? '#f59e0b' : '#10b981'
                      }}>
                        {domain.maxSpamScore.toFixed(1)}/10
                      </strong>
                    </div>
                  )}
                  {domain.avgSpamScore !== undefined && domain.avgSpamScore > 0 && (
                    <div>
                      <span style={{ color: '#9ca3af' }}>Avg Score:</span>{' '}
                      <strong style={{ color: '#f9fafb' }}>
                        {domain.avgSpamScore.toFixed(1)}/10
                      </strong>
                    </div>
                  )}
                  {domain.stopWordsFound && domain.stopWordsFound.length > 0 && (
                    <div>
                      <span style={{ color: '#9ca3af' }}>Stop Words:</span>{' '}
                      <strong style={{ color: '#f9fafb' }}>
                        {domain.stopWordsFound.length}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                        {formatStopWords(domain.stopWordsFound)}
                      </div>
                    </div>
                  )}
                </div>

                {domain.error && (
                  <div style={{
                    marginTop: '12px',
                    padding: '8px',
                    borderRadius: '4px',
                    backgroundColor: '#7f1d1d',
                    border: '1px solid #991b1b',
                    fontSize: '0.85rem',
                    color: '#fca5a5',
                  }}>
                    <strong>Error:</strong> {domain.error}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

