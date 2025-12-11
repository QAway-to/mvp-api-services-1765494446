import { useState } from 'react';

export default function DataPreview({ shopifyData, bitrixData, eventId }) {
  const [activeTab, setActiveTab] = useState('shopify'); // 'shopify' or 'bitrix'

  if (!shopifyData && !bitrixData) {
    return null;
  }

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <header className="card-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Data Preview {eventId && `(Order #${eventId})`}</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {shopifyData && (
              <button
                onClick={() => setActiveTab('shopify')}
                style={{
                  padding: '6px 12px',
                  background: activeTab === 'shopify' ? '#3b82f6' : '#334155',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#f1f5f9',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Shopify Data
              </button>
            )}
            {bitrixData && (
              <button
                onClick={() => setActiveTab('bitrix')}
                style={{
                  padding: '6px 12px',
                  background: activeTab === 'bitrix' ? '#3b82f6' : '#334155',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#f1f5f9',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Bitrix Data
              </button>
            )}
          </div>
        </div>
      </header>
      <div style={{ padding: '20px' }}>
        {activeTab === 'shopify' && shopifyData && (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ color: '#f1f5f9', fontSize: '1rem', margin: 0 }}>Received Shopify Order Data</h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(shopifyData, null, 2));
                  }}
                  style={{
                    padding: '4px 8px',
                    background: '#334155',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    color: '#f1f5f9',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Copy JSON
                </button>
              </div>
              {shopifyData.received_at && (
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px' }}>
                  Received at: {new Date(shopifyData.received_at).toLocaleString()}
                </div>
              )}
            </div>
            <pre style={{
              padding: '16px',
              background: '#1e293b',
              borderRadius: '8px',
              overflowX: 'auto',
              fontSize: '0.85rem',
              color: '#f1f5f9',
              border: '1px solid #334155',
              maxHeight: '600px',
              overflowY: 'auto'
            }}>
              {JSON.stringify(shopifyData, null, 2)}
            </pre>
          </div>
        )}
        {activeTab === 'bitrix' && bitrixData && (
          <div>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#f1f5f9', fontSize: '1rem', margin: 0 }}>Transformed Bitrix24 Deal Data</h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(bitrixData, null, 2));
                }}
                style={{
                  padding: '4px 8px',
                  background: '#334155',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  color: '#f1f5f9',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Copy JSON
              </button>
            </div>
            <pre style={{
              padding: '16px',
              background: '#1e293b',
              borderRadius: '8px',
              overflowX: 'auto',
              fontSize: '0.85rem',
              color: '#f1f5f9',
              border: '1px solid #334155',
              maxHeight: '600px',
              overflowY: 'auto'
            }}>
              {JSON.stringify(bitrixData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
