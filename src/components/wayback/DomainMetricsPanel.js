// Component for displaying domain metrics (DR, Trust Flow, Citation Flow, etc.)
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DomainMetricsPanel({ metrics }) {
  if (!metrics || !metrics.metrics) {
    return (
      <div className="card" style={{ marginTop: '24px' }}>
        <h3>Domain Metrics</h3>
        <p style={{ color: '#9ca3af' }}>No metrics data available</p>
      </div>
    );
  }

  const m = metrics.metrics;

  const metricsData = [
    {
      name: 'Domain Rating',
      value: m.domainRating || 'N/A',
      max: 100,
      source: m.domainRatingSource || 'Unknown',
    },
    {
      name: 'Domain Authority',
      value: m.domainAuthority || 'N/A',
      max: 100,
      source: m.domainAuthoritySource || 'Unknown',
    },
    {
      name: 'Trust Flow',
      value: m.trustFlow || 'N/A',
      max: 100,
      source: m.tfCfSource || 'Unknown',
    },
    {
      name: 'Citation Flow',
      value: m.citationFlow || 'N/A',
      max: 100,
      source: m.tfCfSource || 'Unknown',
    },
    {
      name: 'Spam Score',
      value: m.spamScore || 0,
      max: 100,
      source: 'Calculated',
      isRisk: true, // Higher is worse
    },
    {
      name: 'Overall Quality',
      value: m.overallQualityScore || 'N/A',
      max: 100,
      source: 'Calculated',
    },
  ];

  const getScoreColor = (value, max, isRisk = false) => {
    if (value === 'N/A' || value === null) return '#6b7280';
    const percentage = (value / max) * 100;
    if (isRisk) {
      // For risk scores, higher is worse
      if (percentage >= 70) return '#ef4444';
      if (percentage >= 40) return '#f59e0b';
      return '#10b981';
    } else {
      // For quality scores, higher is better
      if (percentage >= 70) return '#10b981';
      if (percentage >= 40) return '#f59e0b';
      return '#ef4444';
    }
  };

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <h3>Domain Metrics</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '20px' }}>
        {metricsData.map((metric, index) => (
          <div
            key={index}
            style={{
              padding: '16px',
              background: 'rgba(31, 41, 55, 0.6)',
              border: '1px solid #374151',
              borderRadius: '12px',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '8px' }}>
              {metric.name}
            </div>
            <div
              style={{
                fontSize: '1.8rem',
                fontWeight: 700,
                color: getScoreColor(metric.value, metric.max, metric.isRisk),
                marginBottom: '4px',
              }}
            >
              {metric.value === 'N/A' ? 'N/A' : metric.value}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Source: {metric.source}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

