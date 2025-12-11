// Component for displaying topic stability analysis
export default function TopicAnalysisPanel({ topicAnalysis }) {
  if (!topicAnalysis || !topicAnalysis.topicAnalysis) {
    return (
      <div className="card" style={{ marginTop: '24px' }}>
        <h3>Topic Stability</h3>
        <p style={{ color: '#9ca3af' }}>No topic data available</p>
      </div>
    );
  }

  const ta = topicAnalysis.topicAnalysis;

  const getStabilityColor = (score) => {
    if (score === null) return '#6b7280';
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const getSeverityColor = (severity) => {
    if (severity === 'high') return '#ef4444';
    if (severity === 'medium') return '#f59e0b';
    return '#6b7280';
  };

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <h3>Topic Stability Analysis</h3>
      
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '4px' }}>Stability Score</div>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                color: getStabilityColor(ta.stabilityScore),
              }}
            >
              {ta.stabilityScore !== null ? ta.stabilityScore : 'N/A'}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '8px' }}>Interpretation</div>
            <div style={{ color: '#d1d5db' }}>
              {ta.stabilityScore === null
                ? 'No data'
                : ta.stabilityScore >= 70
                ? 'Stable topics over time'
                : ta.stabilityScore >= 40
                ? 'Some topic shifts detected'
                : 'Major topic instability'}
            </div>
          </div>
        </div>

        {ta.redFlags && ta.redFlags.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h4 style={{ marginBottom: '12px' }}>Red Flags</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ta.redFlags.map((flag, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${getSeverityColor(flag.severity)}`,
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        background: getSeverityColor(flag.severity),
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      {flag.severity}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fca5a5' }}>
                      {flag.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#d1d5db' }}>{flag.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {ta.mainTopics && ta.mainTopics.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h4 style={{ marginBottom: '12px' }}>Main Topics (Latest Snapshot)</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {ta.mainTopics.map((topic, index) => (
                <span
                  key={index}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: '#86efac',
                  }}
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {ta.latestTopics && (
          <div style={{ marginTop: '24px' }}>
            <h4 style={{ marginBottom: '12px' }}>Latest Snapshot Info</h4>
            {ta.latestTopics.title && (
              <div style={{ marginBottom: '8px' }}>
                <strong style={{ color: '#9ca3af' }}>Title:</strong>
                <div style={{ color: '#d1d5db', marginTop: '4px' }}>{ta.latestTopics.title}</div>
              </div>
            )}
            {ta.latestTopics.metaDescription && (
              <div style={{ marginBottom: '8px' }}>
                <strong style={{ color: '#9ca3af' }}>Description:</strong>
                <div style={{ color: '#d1d5db', marginTop: '4px' }}>{ta.latestTopics.metaDescription.substring(0, 200)}...</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

