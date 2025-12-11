import { shopifyAdapter } from '../../src/lib/adapters/shopify';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { selectedEvents, bitrixWebhookUrl } = req.body;

  if (!selectedEvents || !Array.isArray(selectedEvents) || selectedEvents.length === 0) {
    return res.status(400).json({ 
      error: 'No selected events provided',
      details: 'Please select at least one event to send'
    });
  }

  if (!bitrixWebhookUrl || typeof bitrixWebhookUrl !== 'string' || bitrixWebhookUrl.trim() === '') {
    return res.status(400).json({ 
      error: 'Bitrix webhook URL is required',
      details: 'Please provide a valid Bitrix webhook URL'
    });
  }

  // Validate URL format
  let validUrl;
  try {
    validUrl = new URL(bitrixWebhookUrl);
    if (!['http:', 'https:'].includes(validUrl.protocol)) {
      return res.status(400).json({ 
        error: 'Invalid URL protocol',
        details: 'Bitrix webhook URL must use http or https protocol'
      });
    }
  } catch (urlError) {
    return res.status(400).json({ 
      error: 'Invalid URL format',
      details: 'Please provide a valid URL for Bitrix webhook'
    });
  }

  const results = [];
  const errors = [];

  for (let i = 0; i < selectedEvents.length; i++) {
    const event = selectedEvents[i];
    
    // Transform Shopify order to Bitrix24 format
    let bitrixData;
    let transformError = null;
    
    try {
      bitrixData = shopifyAdapter.transformToBitrix(event);
    } catch (transformErr) {
      transformError = {
        eventId: event.id,
        success: false,
        error: 'Transformation error',
        details: transformErr.message,
        type: 'TransformationError'
      };
      errors.push(transformError);
      continue;
    }
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    try {
      // Ensure URL ends with / and add method
      const baseUrl = bitrixWebhookUrl.endsWith('/') ? bitrixWebhookUrl : `${bitrixWebhookUrl}/`;
      const apiUrl = `${baseUrl}crm.deal.add.json`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bitrixData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let result;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        result = { raw: text };
      }

      if (response.ok) {
        results.push({
          eventId: event.id,
          success: true,
          status: response.status,
          response: result,
          message: 'Successfully sent to Bitrix',
          shopifyData: event, // Original Shopify data for preview
          bitrixData: bitrixData // Transformed Bitrix data for preview
        });
      } else {
        errors.push({
          eventId: event.id,
          success: false,
          status: response.status,
          statusText: response.statusText,
          response: result,
          error: `HTTP ${response.status}: ${response.statusText}`,
          shopifyData: event, // Original Shopify data for preview
          bitrixData: bitrixData // Transformed Bitrix data for preview
        });
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      let errorMessage = 'Unknown error';
      let errorDetails = null;

      if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
        errorMessage = 'Request timeout';
        errorDetails = 'The request to Bitrix took too long (exceeded 30 seconds)';
      } else if (fetchError.code === 'ENOTFOUND' || fetchError.code === 'ECONNREFUSED') {
        errorMessage = 'Connection error';
        errorDetails = `Cannot connect to Bitrix server: ${fetchError.message}`;
      } else if (fetchError.message) {
        errorMessage = fetchError.message;
        errorDetails = fetchError.message;
      }

      errors.push({
        eventId: event.id,
        success: false,
        error: errorMessage,
        details: errorDetails,
        type: fetchError.name || 'NetworkError',
        shopifyData: event, // Original Shopify data for preview
        bitrixData: bitrixData // Transformed Bitrix data for preview
      });
    }
  }

  const successful = results.length;
  const failed = errors.length;
  const total = selectedEvents.length;

  // Combine results and errors
  const allResults = [...results, ...errors];

  // Return appropriate status code
  if (failed === 0) {
    // All successful
    res.status(200).json({
      success: true,
      message: `Все ${successful} событий успешно отправлены в Bitrix`,
      total,
      successful,
      failed,
      results: allResults
    });
  } else if (successful === 0) {
    // All failed
    res.status(500).json({
      success: false,
      message: `Не удалось отправить события в Bitrix`,
      total,
      successful,
      failed,
      errors: errors,
      results: allResults
    });
  } else {
    // Partial success
    res.status(207).json({
      success: false,
      message: `Отправлено ${successful} из ${total} событий. ${failed} событий не удалось отправить`,
      total,
      successful,
      failed,
      errors: errors,
      results: allResults
    });
  }
}
