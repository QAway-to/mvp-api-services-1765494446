export default function WaybackResults({ result }) {
  if (!result) {
    return null;
  }

  const formatDate = (timestamp) => {
    if (!timestamp || timestamp.length < 8) return timestamp;
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    const hour = timestamp.length >= 10 ? timestamp.substring(8, 10) : '00';
    const minute = timestamp.length >= 12 ? timestamp.substring(10, 12) : '00';
    return `${year}-${month}-${day} ${hour}:${minute}`;
  };

  const formatBytes = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="card">
      <header className="card-header">
        <h2>Results</h2>
      </header>

      {result.snapshotsCount === 0 ? (
        <div className="alert alert-warning">
          <strong>No snapshots found</strong>
          <p>No archived snapshots were found for "{result.target}". The site may not be archived yet, or the URL format is incorrect.</p>
        </div>
      ) : (
        <>
          <div className="metrics-grid">
            <div className="metric">
              <p className="metric-label">Snapshots Found</p>
              <p className="metric-value">{result.snapshotsCount}</p>
            </div>
            {result.firstSnapshotTimestamp && (
              <div className="metric">
                <p className="metric-label">First Snapshot</p>
                <p className="metric-value" style={{ fontSize: '1.1rem' }}>
                  {formatDate(result.firstSnapshotTimestamp)}
                </p>
              </div>
            )}
            {result.firstSnapshotHtmlLength && (
              <div className="metric">
                <p className="metric-label">HTML Size</p>
                <p className="metric-value">{formatBytes(result.firstSnapshotHtmlLength)}</p>
              </div>
            )}
          </div>

          {result.firstSnapshotTimestamp && (
            <div style={{ marginTop: '16px' }}>
              <h3 style={{ marginBottom: '12px', fontSize: '1.1rem' }}>First Snapshot Details</h3>
              <table className="results-table">
                <tbody>
                  <tr>
                    <td style={{ color: '#9ca3af', width: '180px' }}>Timestamp</td>
                    <td><code>{result.firstSnapshotTimestamp}</code></td>
                  </tr>
                  <tr>
                    <td style={{ color: '#9ca3af' }}>Original URL</td>
                    <td>
                      <a href={result.firstSnapshotUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', wordBreak: 'break-all' }}>
                        {result.firstSnapshotUrl}
                      </a>
                    </td>
                  </tr>
                  {result.firstSnapshotWaybackUrl && (
                    <tr>
                      <td style={{ color: '#9ca3af' }}>Wayback URL</td>
                      <td>
                        <a href={result.firstSnapshotWaybackUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', wordBreak: 'break-all' }}>
                          {result.firstSnapshotWaybackUrl}
                        </a>
                      </td>
                    </tr>
                  )}
                  {result.firstSnapshotHtmlLength && (
                    <tr>
                      <td style={{ color: '#9ca3af' }}>HTML Length</td>
                      <td>{formatBytes(result.firstSnapshotHtmlLength)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

