// Component for displaying backlink analysis results
export default function BacklinkAnalysisPanel({ backlinkAnalysis }) {
  if (!backlinkAnalysis || !backlinkAnalysis.backlinkAnalysis) {
    return (
      <div className="card" style={{ marginTop: '24px' }}>
        <h3>Backlink Analysis</h3>
        <p style={{ color: '#9ca3af' }}>No backlink data available</p>
      </div>
    );
  }

  const bl = backlinkAnalysis.backlinkAnalysis;

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <h3>Backlink Profile</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '20px' }}>
        <div style={{ padding: '16px', background: 'rgba(31, 41, 55, 0.6)', border: '1px solid #374151', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '8px' }}>External Links (Avg)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#60a5fa' }}>
            {bl.averageExternalLinks?.toFixed(1) || 'N/A'}
          </div>
        </div>
        
        <div style={{ padding: '16px', background: 'rgba(31, 41, 55, 0.6)', border: '1px solid #374151', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '8px' }}>Quality Score</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: bl.averageQualityScore >= 70 ? '#10b981' : bl.averageQualityScore >= 40 ? '#f59e0b' : '#ef4444' }}>
            {bl.averageQualityScore?.toFixed(1) || 'N/A'}
          </div>
        </div>
        
        <div style={{ padding: '16px', background: 'rgba(31, 41, 55, 0.6)', border: '1px solid #374151', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '8px' }}>Spam Anchors %</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: bl.spamAnchorsPercentage > 50 ? '#ef4444' : bl.spamAnchorsPercentage > 20 ? '#f59e0b' : '#10b981' }}>
            {bl.spamAnchorsPercentage?.toFixed(1) || '0'}%
          </div>
        </div>
        
        <div style={{ padding: '16px', background: 'rgba(31, 41, 55, 0.6)', border: '1px solid #374151', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '8px' }}>Nofollow %</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#60a5fa' }}>
            {bl.nofollowPercentage?.toFixed(1) || '0'}%
          </div>
        </div>
      </div>

      {bl.topExternalDomains && bl.topExternalDomains.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h4 style={{ marginBottom: '12px' }}>Top External Domains</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {bl.topExternalDomains.slice(0, 10).map((domain, index) => (
              <span
                key={index}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(37, 99, 235, 0.1)',
                  border: '1px solid rgba(37, 99, 235, 0.3)',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  color: '#93c5fd',
                }}
              >
                {domain}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

