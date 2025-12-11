import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import WebhookInfo from '../../src/components/shopify/WebhookInfo';
import EventsList from '../../src/components/shopify/EventsList';
import DataPreview from '../../src/components/shopify/DataPreview';
import { shopifyAdapter } from '../../src/lib/adapters/shopify';

export default function ShopifyPage() {
  const [events, setEvents] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  // Hardcoded Bitrix webhook base URL
  const [bitrixWebhookUrl, setBitrixWebhookUrl] = useState('https://bfcshoes.bitrix24.eu/rest/52/i6l05o71ywxb8j1l');
  const [previewEvent, setPreviewEvent] = useState(null); // Event to preview
  const [previewData, setPreviewData] = useState(null); // { shopifyData, bitrixData } for preview
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track initial load

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/events');
      const data = await response.json();

      if (data.success) {
        const fetchedEvents = data.events || [];
        setEvents(fetchedEvents);
        setLastRefresh(new Date());
        
        // Update preview if the previewed event still exists
        if (previewEvent && previewData) {
          const updatedEvent = fetchedEvents.find(e => e.id === previewEvent.id);
          if (updatedEvent) {
            try {
              const bitrixData = shopifyAdapter.transformToBitrix(updatedEvent);
              setPreviewEvent(updatedEvent);
              setPreviewData({
                shopifyData: updatedEvent,
                bitrixData: bitrixData
              });
            } catch (error) {
              console.error('Error updating preview:', error);
            }
          }
        }
        
        // Auto-select all events only on initial load (first time only)
        if (isInitialLoad && fetchedEvents.length > 0) {
          setSelectedEvents(fetchedEvents);
          setIsInitialLoad(false);
        }
      } else {
        setError(data.error || 'Failed to fetch events');
      }
    } catch (err) {
      console.error('Fetch events error:', err);
      setError(err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchEvents();

    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchEvents, 5000);

    return () => clearInterval(interval);
  }, []);


  const handlePreviewEvent = (event) => {
    try {
      const bitrixData = shopifyAdapter.transformToBitrix(event);
      setPreviewEvent(event);
      setPreviewData({
        shopifyData: event,
        bitrixData: bitrixData
      });
    } catch (error) {
      alert(`Ошибка при трансформации: ${error.message}`);
    }
  };


  const handleSelectAll = () => {
    if (events.length > 0) {
      setSelectedEvents(events);
    }
  };

  const handleDeselectAll = () => {
    setSelectedEvents([]);
  };


  return (
    <>
      <Head>
        <title>Shopify Webhook - API Services</title>
        <meta name="description" content="Monitor Shopify webhook events" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <main className="page">
        <header className="page-header">
          <div>
            <h1>Shopify Webhook</h1>
            <p className="subtitle">
              Receive and monitor Shopify webhook events in real-time
            </p>
          </div>
          <div className="header-actions">
            <button
              onClick={fetchEvents}
              className="btn"
              disabled={isLoading}
              style={{ marginRight: '12px' }}
            >
              {isLoading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
            <Link href="/" className="btn">
              ← Back
            </Link>
          </div>
        </header>

        {lastRefresh && (
          <div style={{
            padding: '8px 16px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            color: '#94a3b8'
          }}>
            Last refreshed: {lastRefresh.toLocaleTimeString()} (Auto-refresh every 5s)
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Webhook Configuration */}
        <WebhookInfo onBitrixUrlChange={setBitrixWebhookUrl} />

        {/* Events List and Details */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '20px',
          marginTop: '20px'
        }}>
          <EventsList
            events={events}
            selectedEvents={selectedEvents}
            onSelectionChange={setSelectedEvents}
            onPreviewEvent={handlePreviewEvent}
          />
          <div className="card">
            <header className="card-header">
              <h2>Selected Events Summary</h2>
            </header>
            <div style={{ padding: '20px' }}>
              {selectedEvents.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>No events selected</p>
              ) : (
                <div>
                  <p style={{ color: '#f1f5f9', marginBottom: '12px' }}>
                    <strong>{selectedEvents.length}</strong> event(s) selected for sending to Bitrix
                  </p>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {selectedEvents.map((event, index) => (
                      <div key={event.id || index} style={{
                        padding: '8px 12px',
                        marginBottom: '8px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '6px',
                        border: '1px solid #3b82f6'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>
                            Order #{event.id}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                            {event.total_price} {event.currency}
                          </span>
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>
                          {event.email}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Data Preview */}
        {previewData && previewEvent && (
          <DataPreview
            shopifyData={previewData.shopifyData}
            bitrixData={previewData.bitrixData}
            eventId={previewEvent.id}
          />
        )}
      </main>
    </>
  );
}

