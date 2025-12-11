export default function SpamAnalysisResults({ results, summary, onExportCSV }) {
  if (!results || results.length === 0) {
    return null;
  }

  const getStatusBadge = (status) => {
    const badges = {
      clean: 'status-success',
      suspicious: 'status-warning',
      spam: 'status-error',
      error: 'status-error',
      no_snapshots: 'status-info',
    };
    return badges[status] || 'status-info';
  };

  const getStatusLabel = (status) => {
    const labels = {
      clean: 'Clean',
      suspicious: 'Suspicious',
      spam: 'Spam',
      error: 'Error',
      no_snapshots: 'No Snapshots',
    };
    return labels[status] || status;
  };

  const formatDate = (timestamp) => {
    if (!timestamp || timestamp.length < 8) return timestamp;
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    return `${year}-${month}-${day}`;
  };

  return (
    <>
      {/* Summary */}
      {summary && (
        <div className="card">
          <header className="card-header">
            <h2>Analysis Summary</h2>
          </header>
          <div className="metrics-grid">
            <div className="metric">
              <p className="metric-label">Total Domains</p>
              <p className="metric-value">{summary.total}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Clean</p>
              <p className="metric-value" style={{ color: '#34d399' }}>{summary.clean}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Suspicious</p>
              <p className="metric-value" style={{ color: '#fbbf24' }}>{summary.suspicious}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Spam</p>
              <p className="metric-value" style={{ color: '#f87171' }}>{summary.spam}</p>
            </div>
            {summary.errors > 0 && (
              <div className="metric">
                <p className="metric-label">Errors</p>
                <p className="metric-value" style={{ color: '#f87171' }}>{summary.errors}</p>
              </div>
            )}
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
            <button
              onClick={onExportCSV}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              📥 Export to CSV
            </button>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="card">
        <header className="card-header">
          <h2>Detailed Results</h2>
        </header>
        <div style={{ overflowX: 'auto' }}>
          <table className="results-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Status</th>
                <th>Snapshots</th>
                <th>Spam %</th>
                <th>Stop Words</th>
                <th>First Spam Date</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => (
                <tr key={index}>
                  <td>
                    <strong>{result.domain}</strong>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusBadge(result.status)}`}>
                      {getStatusLabel(result.status)}
                    </span>
                  </td>
                  <td>
                    {result.snapshotsChecked || result.error ? (
                      <>{result.snapshotsChecked || 0} checked</>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>—</span>
                    )}
                  </td>
                  <td>
                    {result.spamPercentage !== undefined ? (
                      <span style={{
                        color: result.spamPercentage >= 50 ? '#f87171' : result.spamPercentage > 0 ? '#fbbf24' : '#34d399'
                      }}>
                        {result.spamPercentage}%
                      </span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>—</span>
                    )}
                  </td>
                  <td>
                    {result.stopWordsFound && result.stopWordsFound.length > 0 ? (
                      <div style={{ fontSize: '0.85rem' }}>
                        {result.stopWordsFound.slice(0, 3).map(sw => sw.word).join(', ')}
                        {result.stopWordsFound.length > 3 && ` +${result.stopWordsFound.length - 3}`}
                      </div>
                    ) : result.error ? (
                      <span style={{ color: '#f87171', fontSize: '0.85rem' }}>Error</span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>None</span>
                    )}
                  </td>
                  <td>
                    {result.firstSpamDate ? (
                      <span style={{ fontSize: '0.85rem' }}>{formatDate(result.firstSpamDate)}</span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

