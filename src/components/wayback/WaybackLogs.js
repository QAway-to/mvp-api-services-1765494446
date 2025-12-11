import React from 'react';

export default function WaybackLogs({ logs }) {
  if (!logs || logs.length === 0) {
    return null;
  }

  const getLogClass = (type) => {
    switch (type) {
      case 'success':
        return 'log-success';
      case 'error':
        return 'log-error';
      case 'warning':
        return 'log-warning';
      default:
        return 'log-info';
    }
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour12: true, 
        hour: 'numeric', 
        minute: '2-digit', 
        second: '2-digit' 
      });
    } catch {
      return timestamp;
    }
  };

  // Автопрокрутка к последнему логу
  const logsEndRef = React.useRef(null);
  
  React.useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className="card">
      <header className="card-header">
        <h2>Logs</h2>
        <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
          {logs.length} entries
        </span>
      </header>
      <div 
        className="logs-container" 
        style={{ 
          maxHeight: '400px', 
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          lineHeight: '1.5'
        }}
      >
        {logs.map((log, index) => (
          <div 
            key={index} 
            className="log-entry"
            style={{
              padding: '4px 8px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              wordBreak: 'break-word'
            }}
          >
            <span className="log-timestamp" style={{ color: '#9ca3af', marginRight: '8px' }}>
              [{formatTimestamp(log.timestamp)}]
            </span>
            <span className={getLogClass(log.type)}>{log.message}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

