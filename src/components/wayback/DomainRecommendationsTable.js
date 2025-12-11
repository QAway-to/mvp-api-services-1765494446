// Component for displaying comprehensive domain analysis results with recommendations

const RECOMMENDATION_COLORS = {
  BUY: '#10b981',
  REVIEW: '#f59e0b',
  CAUTION: '#f97316',
  AVOID: '#ef4444',
};

const RISK_LEVEL_COLORS = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
};

export default function DomainRecommendationsTable({ domains }) {
  if (!domains || domains.length === 0) {
    return null;
  }

  // Filter only domains with complete analysis
  const completeAnalyses = domains.filter(d => d.status === 'COMPLETE' && d.overallRiskScore !== undefined);

  if (completeAnalyses.length === 0) {
    return (
      <div className="card" style={{ marginTop: '24px' }}>
        <h3>Complete Analysis Results</h3>
        <p style={{ color: '#9ca3af' }}>No complete analysis results available yet. Please wait for analysis to complete.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <h3>Complete Analysis Results & Recommendations</h3>
      
      <div style={{ overflowX: 'auto', marginTop: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #374151' }}>
              <th style={{ padding: '12px', textAlign: 'left', color: '#9ca3af', fontWeight: 600 }}>Domain</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Spam Score</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Backlinks</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Metrics</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Topic Stability</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Risk Level</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Recommendation</th>
              <th style={{ padding: '12px', textAlign: 'left', color: '#9ca3af', fontWeight: 600 }}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {completeAnalyses.map((domain, index) => {
              const spamScore = domain.spamAnalysis?.maxSpamScore || 0;
              const backlinkQuality = domain.backlinkAnalysis?.averageQualityScore || 0;
              const metricsQuality = domain.metrics?.overallQualityScore || 0;
              const topicStability = domain.topicAnalysis?.stabilityScore || 0;
              const riskScore = domain.overallRiskScore || 0;
              const recommendation = domain.recommendation || 'REVIEW';
              const riskLevel = domain.riskLevel || 'MEDIUM';
              const recommendationReason = domain.recommendationReason || 'No reason provided';

              return (
                <tr key={index} style={{ borderBottom: '1px solid #374151' }}>
                  <td style={{ padding: '12px', color: '#f1f5f9', fontWeight: 600 }}>
                    {domain.domain}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background: spamScore >= 8 ? 'rgba(239, 68, 68, 0.2)' : spamScore >= 5 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: spamScore >= 8 ? '#fca5a5' : spamScore >= 5 ? '#fde68a' : '#86efac',
                      }}
                    >
                      {spamScore.toFixed(1)}/10
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background: backlinkQuality >= 70 ? 'rgba(16, 185, 129, 0.2)' : backlinkQuality >= 40 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: backlinkQuality >= 70 ? '#86efac' : backlinkQuality >= 40 ? '#fde68a' : '#fca5a5',
                      }}
                    >
                      {backlinkQuality.toFixed(0)}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background: metricsQuality >= 70 ? 'rgba(16, 185, 129, 0.2)' : metricsQuality >= 40 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: metricsQuality >= 70 ? '#86efac' : metricsQuality >= 40 ? '#fde68a' : '#fca5a5',
                      }}
                    >
                      {metricsQuality || 'N/A'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background: topicStability >= 70 ? 'rgba(16, 185, 129, 0.2)' : topicStability >= 40 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: topicStability >= 70 ? '#86efac' : topicStability >= 40 ? '#fde68a' : '#fca5a5',
                      }}
                    >
                      {topicStability || 'N/A'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background: `rgba(${riskLevel === 'HIGH' ? '239, 68, 68' : riskLevel === 'MEDIUM' ? '245, 158, 11' : '16, 185, 129'}, 0.2)`,
                        color: RISK_LEVEL_COLORS[riskLevel] || '#9ca3af',
                      }}
                    >
                      {riskLevel}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '6px 16px',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        background: `rgba(${recommendation === 'AVOID' ? '239, 68, 68' : recommendation === 'CAUTION' ? '249, 115, 22' : recommendation === 'REVIEW' ? '245, 158, 11' : '16, 185, 129'}, 0.2)`,
                        color: RECOMMENDATION_COLORS[recommendation] || '#9ca3af',
                        border: `2px solid ${RECOMMENDATION_COLORS[recommendation] || '#9ca3af'}`,
                      }}
                    >
                      {recommendation}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#9ca3af', fontSize: '0.875rem', maxWidth: '300px' }}>
                    <div style={{ 
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: '1.4'
                    }}>
                      {recommendationReason}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(31, 41, 55, 0.6)', borderRadius: '12px' }}>
        <h4 style={{ marginBottom: '12px' }}>Legend</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div>
            <strong style={{ color: RECOMMENDATION_COLORS.BUY }}>BUY</strong>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Low risk, good metrics</div>
          </div>
          <div>
            <strong style={{ color: RECOMMENDATION_COLORS.REVIEW }}>REVIEW</strong>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Medium risk, review carefully</div>
          </div>
          <div>
            <strong style={{ color: RECOMMENDATION_COLORS.CAUTION }}>CAUTION</strong>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>High risk, proceed with caution</div>
          </div>
          <div>
            <strong style={{ color: RECOMMENDATION_COLORS.AVOID }}>AVOID</strong>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Very high risk, avoid</div>
          </div>
        </div>
      </div>
    </div>
  );
}

