import { useState, useEffect } from 'react';

export default function WebhookInfo({ onBitrixUrlChange }) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [bitrixWebhookEndpointUrl, setBitrixWebhookEndpointUrl] = useState('');
  // Hardcoded Bitrix webhook base URL (for sending to Bitrix)
  const [bitrixWebhookUrl, setBitrixWebhookUrl] = useState('https://bfcshoes.bitrix24.eu/rest/52/i6l05o71ywxb8j1l');
  const [copied, setCopied] = useState(false);
  const [bitrixEndpointCopied, setBitrixEndpointCopied] = useState(false);
  const [bitrixCopied, setBitrixCopied] = useState(false);
  const [shopifyPassword, setShopifyPassword] = useState('');
  const [bitrixEndpointPassword, setBitrixEndpointPassword] = useState('');
  const [bitrixPassword, setBitrixPassword] = useState('');
  const [shopifyUnlocked, setShopifyUnlocked] = useState(false);
  const [bitrixEndpointUnlocked, setBitrixEndpointUnlocked] = useState(false);
  const [bitrixUnlocked, setBitrixUnlocked] = useState(false);
  
  const CORRECT_PASSWORD = '1spotify2';

  useEffect(() => {
    // Get webhook URL from current origin
    const url = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/webhook/shopify`
      : '/api/webhook/shopify';
    setWebhookUrl(url);
    
    // Get Bitrix webhook endpoint URL
    const bitrixEndpointUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/webhook/bitrix`
      : '/api/webhook/bitrix';
    setBitrixWebhookEndpointUrl(bitrixEndpointUrl);
  }, []);

  useEffect(() => {
    // Notify parent component about Bitrix URL change
    if (onBitrixUrlChange) {
      onBitrixUrlChange(bitrixWebhookUrl);
    }
  }, [bitrixWebhookUrl, onBitrixUrlChange]);

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBitrixCopy = () => {
    navigator.clipboard.writeText(bitrixWebhookUrl);
    setBitrixCopied(true);
    setTimeout(() => setBitrixCopied(false), 2000);
  };

  const handleShopifyPasswordSubmit = (e) => {
    e.preventDefault();
    if (shopifyPassword === CORRECT_PASSWORD) {
      setShopifyUnlocked(true);
      setShopifyPassword('');
    } else {
      alert('Incorrect password');
      setShopifyPassword('');
    }
  };

  const handleBitrixEndpointPasswordSubmit = (e) => {
    e.preventDefault();
    if (bitrixEndpointPassword === CORRECT_PASSWORD) {
      setBitrixEndpointUnlocked(true);
      setBitrixEndpointPassword('');
    } else {
      alert('Incorrect password');
      setBitrixEndpointPassword('');
    }
  };

  const handleBitrixPasswordSubmit = (e) => {
    e.preventDefault();
    if (bitrixPassword === CORRECT_PASSWORD) {
      setBitrixUnlocked(true);
      setBitrixPassword('');
    } else {
      alert('Incorrect password');
      setBitrixPassword('');
    }
  };

  // Mask URL for security (show only domain)
  const maskUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return `${urlObj.origin}/***`;
    } catch {
      return '***';
    }
  };

  return (
    <div className="card">
      <header className="card-header">
        <h2>Webhook Configuration</h2>
      </header>
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <p style={{ color: '#94a3b8', marginBottom: '8px', fontSize: '0.9rem' }}>
            Shopify webhook endpoint is configured and ready to receive events.
          </p>
          {!shopifyUnlocked ? (
            <form onSubmit={handleShopifyPasswordSubmit} style={{ marginBottom: '8px' }}>
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                padding: '12px',
                background: '#1e293b',
                borderRadius: '8px',
                border: '1px solid #334155'
              }}>
                <input
                  type="password"
                  value={shopifyPassword}
                  onChange={(e) => setShopifyPassword(e.target.value)}
                  placeholder="Enter password to view URL"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#f1f5f9',
                    fontSize: '0.9rem',
                    outline: 'none',
                    padding: '4px 8px'
                  }}
                />
                <button
                  type="submit"
                  className="btn"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Unlock
                </button>
              </div>
            </form>
          ) : (
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              padding: '12px',
              background: '#1e293b',
              borderRadius: '8px',
              border: '1px solid #334155'
            }}>
              <code style={{
                flex: 1,
                color: '#f1f5f9',
                fontSize: '0.9rem',
                wordBreak: 'break-all',
                fontFamily: 'monospace'
              }}>
                {webhookUrl}
              </code>
              <button
                onClick={handleCopy}
                className="btn"
                style={{ whiteSpace: 'nowrap' }}
                title="Copy webhook URL"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button
                onClick={() => setShopifyUnlocked(false)}
                className="btn"
                style={{ whiteSpace: 'nowrap', background: '#6b7280' }}
                title="Lock URL"
              >
                🔒 Lock
              </button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <p style={{ color: '#94a3b8', marginBottom: '8px', fontSize: '0.9rem' }}>
            Bitrix24 webhook endpoint is configured and ready to receive events.
          </p>
          {!bitrixEndpointUnlocked ? (
            <form onSubmit={handleBitrixEndpointPasswordSubmit} style={{ marginBottom: '8px' }}>
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                padding: '12px',
                background: '#1e293b',
                borderRadius: '8px',
                border: '1px solid #334155'
              }}>
                <input
                  type="password"
                  value={bitrixEndpointPassword}
                  onChange={(e) => setBitrixEndpointPassword(e.target.value)}
                  placeholder="Enter password to view URL"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#f1f5f9',
                    fontSize: '0.9rem',
                    outline: 'none',
                    padding: '4px 8px'
                  }}
                />
                <button
                  type="submit"
                  className="btn"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Unlock
                </button>
              </div>
            </form>
          ) : (
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              padding: '12px',
              background: '#1e293b',
              borderRadius: '8px',
              border: '1px solid #334155'
            }}>
              <code style={{
                flex: 1,
                color: '#f1f5f9',
                fontSize: '0.9rem',
                wordBreak: 'break-all',
                fontFamily: 'monospace'
              }}>
                {bitrixWebhookEndpointUrl}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(bitrixWebhookEndpointUrl);
                  setBitrixEndpointCopied(true);
                  setTimeout(() => setBitrixEndpointCopied(false), 2000);
                }}
                className="btn"
                style={{ whiteSpace: 'nowrap' }}
                title="Copy webhook URL"
              >
                {bitrixEndpointCopied ? '✓ Copied' : 'Copy'}
              </button>
              <button
                onClick={() => setBitrixEndpointUnlocked(false)}
                className="btn"
                style={{ whiteSpace: 'nowrap', background: '#6b7280' }}
                title="Lock URL"
              >
                🔒 Lock
              </button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <p style={{ color: '#94a3b8', marginBottom: '8px', fontSize: '0.9rem' }}>
            Bitrix24 webhook is configured for sending events.
          </p>
          {!bitrixUnlocked ? (
            <form onSubmit={handleBitrixPasswordSubmit} style={{ marginBottom: '8px' }}>
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                padding: '12px',
                background: '#1e293b',
                borderRadius: '8px',
                border: '1px solid #334155'
              }}>
                <input
                  type="password"
                  value={bitrixPassword}
                  onChange={(e) => setBitrixPassword(e.target.value)}
                  placeholder="Enter password to view/edit URL"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#f1f5f9',
                    fontSize: '0.9rem',
                    outline: 'none',
                    padding: '4px 8px'
                  }}
                />
                <button
                  type="submit"
                  className="btn"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Unlock
                </button>
              </div>
            </form>
          ) : (
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              padding: '12px',
              background: '#1e293b',
              borderRadius: '8px',
              border: '1px solid #334155'
            }}>
              <input
                type="text"
                value={bitrixWebhookUrl}
                onChange={(e) => setBitrixWebhookUrl(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#f1f5f9',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                  outline: 'none',
                  padding: '4px 8px'
                }}
                placeholder="Enter Bitrix webhook URL"
              />
              <button
                onClick={handleBitrixCopy}
                className="btn"
                style={{ whiteSpace: 'nowrap' }}
                title="Copy webhook URL"
              >
                {bitrixCopied ? '✓ Copied' : 'Copy'}
              </button>
              <button
                onClick={() => setBitrixUnlocked(false)}
                className="btn"
                style={{ whiteSpace: 'nowrap', background: '#6b7280' }}
                title="Lock URL"
              >
                🔒 Lock
              </button>
            </div>
          )}
        </div>

        <div className="alert alert-info" style={{ marginTop: '20px' }}>
          <strong>Setup Instructions:</strong>
          <ol style={{ marginTop: '12px', paddingLeft: '20px', color: '#cbd5e1' }}>
            <li style={{ marginBottom: '8px' }}>Go to your Shopify Admin</li>
            <li style={{ marginBottom: '8px' }}>Navigate to Settings → Notifications</li>
            <li style={{ marginBottom: '8px' }}>Scroll to "Webhooks" section</li>
            <li style={{ marginBottom: '8px' }}>Click "Create webhook"</li>
            <li style={{ marginBottom: '8px' }}>Select event type (e.g., "Order creation")</li>
            <li style={{ marginBottom: '8px' }}>Use the webhook URL (click Copy button above)</li>
            <li style={{ marginBottom: '8px' }}>Select format: JSON</li>
            <li>Save the webhook</li>
          </ol>
        </div>

        <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <p style={{ color: '#60a5fa', fontWeight: 600, marginBottom: '8px' }}>ℹ Supported Webhook Schema</p>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '4px' }}>
            The endpoint accepts Shopify webhook payloads with the following structure:
          </p>
          <ul style={{ color: '#cbd5e1', fontSize: '0.85rem', paddingLeft: '20px', marginTop: '8px' }}>
            <li>Order ID, email, created_at, currency, total_price</li>
            <li>Line items (id, title, quantity, price, sku)</li>
            <li>Discount codes (code, amount, type)</li>
            <li>Customer information (id, first_name, last_name, email)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

