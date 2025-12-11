export default function EventDetails({ event }) {
  if (!event) {
    return (
      <div className="card">
        <header className="card-header">
          <h2>Event Details</h2>
        </header>
        <div className="alert alert-info">
          <p>Select an event from the list to view details</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="card">
      <header className="card-header">
        <h2>Event Details</h2>
      </header>

      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '12px', color: '#f1f5f9', fontSize: '1.1rem' }}>Order Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '4px' }}>Order ID</p>
              <p style={{ color: '#f1f5f9', fontWeight: 600 }}>{event.id || 'N/A'}</p>
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '4px' }}>Email</p>
              <p style={{ color: '#f1f5f9', fontWeight: 600 }}>{event.email || 'N/A'}</p>
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '4px' }}>Total Price</p>
              <p style={{ color: '#f1f5f9', fontWeight: 600 }}>{event.total_price || 'N/A'} {event.currency || ''}</p>
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '4px' }}>Created At</p>
              <p style={{ color: '#f1f5f9', fontWeight: 600 }}>{formatDate(event.created_at)}</p>
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '4px' }}>Received At</p>
              <p style={{ color: '#f1f5f9', fontWeight: 600 }}>{formatDate(event.received_at)}</p>
            </div>
          </div>
        </div>

        {event.customer && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '12px', color: '#f1f5f9', fontSize: '1.1rem' }}>Customer</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {event.customer.id && (
                <div>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '4px' }}>Customer ID</p>
                  <p style={{ color: '#f1f5f9', fontWeight: 600 }}>{event.customer.id}</p>
                </div>
              )}
              {event.customer.first_name && (
                <div>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '4px' }}>First Name</p>
                  <p style={{ color: '#f1f5f9', fontWeight: 600 }}>{event.customer.first_name}</p>
                </div>
              )}
              {event.customer.last_name && (
                <div>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '4px' }}>Last Name</p>
                  <p style={{ color: '#f1f5f9', fontWeight: 600 }}>{event.customer.last_name}</p>
                </div>
              )}
              {event.customer.email && (
                <div>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '4px' }}>Email</p>
                  <p style={{ color: '#f1f5f9', fontWeight: 600 }}>{event.customer.email}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {event.line_items && event.line_items.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '12px', color: '#f1f5f9', fontSize: '1.1rem' }}>Line Items ({event.line_items.length})</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #334155' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8' }}>Title</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8' }}>Quantity</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8' }}>Price</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8' }}>SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {event.line_items.map((item, index) => (
                    <tr key={item.id || index} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '12px', color: '#f1f5f9' }}>{item.title || 'N/A'}</td>
                      <td style={{ padding: '12px', color: '#f1f5f9' }}>{item.quantity || 'N/A'}</td>
                      <td style={{ padding: '12px', color: '#f1f5f9' }}>{item.price || 'N/A'}</td>
                      <td style={{ padding: '12px', color: '#f1f5f9' }}>{item.sku || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {event.discount_codes && event.discount_codes.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '12px', color: '#f1f5f9', fontSize: '1.1rem' }}>Discount Codes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {event.discount_codes.map((code, index) => (
                <div key={index} style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' }}>
                  <p style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: '4px' }}>{code.code || 'N/A'}</p>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                    {code.amount || 'N/A'} ({code.type || 'N/A'})
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 style={{ marginBottom: '12px', color: '#f1f5f9', fontSize: '1.1rem' }}>Raw JSON</h3>
          <pre style={{
            padding: '16px',
            background: '#1e293b',
            borderRadius: '8px',
            overflowX: 'auto',
            fontSize: '0.85rem',
            color: '#f1f5f9',
            border: '1px solid #334155'
          }}>
            {JSON.stringify(event, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

