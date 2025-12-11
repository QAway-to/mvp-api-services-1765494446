// Wayback Machine HTTP client
// Handles CDX API requests and snapshot HTML fetching

export class WaybackClient {
  constructor(timeout = 120000) {
    // УВЕЛИЧЕНО: 120 секунд (2 минуты) timeout для обработки медленных запросов
    // Расчет: 10 snapshots × 3s delay = 30s + запросы ~2-5s каждый = 50-80s минимум
    this.timeout = timeout;
    this.cdxBaseUrl = 'https://web.archive.org/cdx/search/cdx';
    this.webBaseUrl = 'https://web.archive.org/web';
    
    // In-memory cache for snapshots: key = `${timestamp}|${originalUrl}`, value = { html, length, snapshotUrl }
    this.snapshotCache = new Map();
  }

  /**
   * Normalize target URL/domain for CDX API
   */
  normalizeTarget(target) {
    // Remove protocol if present
    let normalized = target.trim();
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      try {
        const url = new URL(normalized);
        normalized = url.hostname + url.pathname;
      } catch (e) {
        // Invalid URL, return as is after trimming
        normalized = normalized.replace(/^https?:\/\//, '');
      }
    }
    // Remove trailing slash for consistency
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  /**
   * Fetch snapshots from CDX API with retry logic for rate limiting
   * Uses field list (fl) to get only needed fields: timestamp, original, statuscode, mime, length
   */
  async getSnapshots(target, limit = 10, retryCount = 0, maxRetries = 3) {
    const normalizedTarget = this.normalizeTarget(target);
    
    const params = new URLSearchParams({
      url: normalizedTarget,
      output: 'json',
      fl: 'timestamp,original,statuscode,mime,length',
      filter: 'statuscode:200',
      limit: limit.toString(),
    });

    const url = `${this.cdxBaseUrl}?${params.toString()}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.timeout);

      let response;
      try {
        response = await fetch(url, {
          headers: {
            'User-Agent': 'WebScraper-MVP/1.0',
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // Handle rate limiting (429) with retry and exponential backoff
      if (response && response.status === 429) {
        if (retryCount < maxRetries) {
          const waitTime = Math.pow(2, retryCount) * 2000; // Exponential backoff: 2s, 4s, 8s
          console.log(`Rate limited (429). Waiting ${waitTime/1000}s before retry ${retryCount + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return await this.getSnapshots(target, limit, retryCount + 1, maxRetries);
        } else {
          throw new Error(`CDX API rate limit exceeded after ${maxRetries} retries. Please try again later.`);
        }
      }

      if (!response || !response.ok) {
        const status = response ? response.status : 'Unknown';
        throw new Error(`CDX API returned HTTP ${status}`);
      }

      const data = await response.json();

      // CDX API returns array of arrays
      // With fl parameter: [timestamp, original, statuscode, mime, length]
      // First row might be headers, skip if it doesn't look like data
      if (!Array.isArray(data) || data.length === 0) {
        return [];
      }

      // Determine if first row is header or data
      const firstRow = data[0];
      const hasHeaders = firstRow && typeof firstRow[0] === 'string' && 
                         (firstRow[0] === 'timestamp' || firstRow[0] === 'Timestamp');
      
      const rows = hasHeaders ? data.slice(1) : data;

      return rows.map(row => {
        // With fl=timestamp,original,statuscode,mime,length:
        // row[0] = timestamp
        // row[1] = original (the actual URL, e.g. "http://www.paydayloan.com/")
        // row[2] = statuscode
        // row[3] = mime
        // row[4] = length
        const timestamp = row[0] || '';
        const originalUrl = row[1] || ''; // This should be the actual URL, not SURT format
        const statusCode = row[2] ? parseInt(row[2], 10) : null;

        // Verify that originalUrl is a proper URL (starts with http:// or https://)
        // If not, it might be SURT format and we need to handle it
        if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
          console.warn(`Warning: originalUrl doesn't start with http:// or https://: "${originalUrl}"`);
        }

        return {
          timestamp: timestamp,
          originalUrl: originalUrl, // Should be full URL like "http://www.paydayloan.com/"
          statusCode: statusCode,
        };
      }).filter(snapshot => snapshot.timestamp && snapshot.originalUrl);
    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw new Error(`Failed to fetch snapshots: ${error.message}`);
    }
  }

  /**
   * Build Wayback Machine snapshot URL
   * @param {string} timestamp - Snapshot timestamp (14 digits)
   * @param {string} originalUrl - Original URL (should start with http:// or https://)
   */
  buildSnapshotUrl(timestamp, originalUrl) {
    // originalUrl should be a full URL like "http://www.paydayloan.com/" or "https://888casino.com/"
    // Wayback Machine expects it in the format: /web/{timestamp}/{originalUrl}
    // where originalUrl can include protocol
    if (!originalUrl) {
      throw new Error('originalUrl is required');
    }
    
    // Use originalUrl as-is (Wayback handles it correctly)
    // If it starts with http:// or https://, that's fine
    return `${this.webBaseUrl}/${timestamp}/${originalUrl}`;
  }

  /**
   * Parse Wayback Machine snapshot URL to extract timestamp and original URL
   * Handles URLs with flags like id_, if_, etc.
   * @param {string} snapshotUrl - Wayback Machine snapshot URL
   * @returns {{timestamp: string, originalUrl: string} | null}
   */
  parseWaybackSnapshotUrl(snapshotUrl) {
    try {
      const url = new URL(snapshotUrl);
      const pathParts = url.pathname.split('/');
      
      // Find '/web/' segment
      const webIndex = pathParts.indexOf('web');
      if (webIndex === -1 || webIndex + 1 >= pathParts.length) {
        return null;
      }
      
      // Get timestamp (next segment after 'web')
      const timestamp = pathParts[webIndex + 1];
      if (!timestamp || !/^\d{14}$/.test(timestamp)) {
        // Timestamp might have flags like id_ or if_ appended
        const timestampWithFlags = pathParts[webIndex + 1];
        const timestampMatch = timestampWithFlags.match(/^(\d{14})/);
        if (!timestampMatch) {
          return null;
        }
        const extractedTimestamp = timestampMatch[1];
        // Reconstruct original URL from remaining parts
        const remainingParts = pathParts.slice(webIndex + 2);
        const originalUrl = remainingParts.join('/');
        return { timestamp: extractedTimestamp, originalUrl };
      }
      
      // Reconstruct original URL from remaining parts
      const remainingParts = pathParts.slice(webIndex + 2);
      const originalUrl = remainingParts.join('/');
      
      return { timestamp, originalUrl };
    } catch (error) {
      console.error('Error parsing Wayback snapshot URL:', error);
      return null;
    }
  }

  /**
   * Check if HTML is a Wayback Machine wrapper page
   * @param {string} html - HTML content to check
   * @returns {boolean}
   */
  isWaybackWrapperHtml(html) {
    if (!html || typeof html !== 'string') {
      return false;
    }
    // Check for Wayback Machine wrapper indicators
    return html.includes('Wayback Machine') && 
           (html.includes('playback') || html.includes('wm-ipp') || html.includes('web.archive.org/web'));
  }

  /**
   * Calculate exponential backoff delay for retries
   * @param {number} retryCount - Current retry attempt (0-based)
   * @returns {number} Delay in milliseconds
   */
  getBackoffDelay(retryCount) {
    return Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s, 16s...
  }

  /**
   * Create a fetch request with timeout and proper cleanup
   * @param {string} url - URL to fetch
   * @param {object} options - Fetch options
   * @returns {Promise<Response>}
   */
  async createFetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Extract original HTML content from Wayback Machine wrapper page
   * 
   * Strategy:
   * 1. Look for iframe#playback - this contains the original content
   * 2. Extract iframe src and construct raw URL
   * 3. Fetch raw HTML directly
   * 4. If extraction fails, return original wrapper HTML as fallback
   * 
   * @param {string} wrapperHtml - Wayback Machine wrapper HTML
   * @param {string} snapshotUrl - Original snapshot URL for context
   * @returns {Promise<string>} Original HTML content or fallback to wrapperHtml
   */
  async extractOriginalHtmlFromWaybackWrapper(wrapperHtml, snapshotUrl) {
    try {
      const parsed = this.parseWaybackSnapshotUrl(snapshotUrl);
      if (!parsed) {
        console.warn('[Wayback] Could not parse snapshot URL, returning wrapper HTML as-is');
        return wrapperHtml;
      }

      const { timestamp, originalUrl } = parsed;
      console.log(`[Wayback] Extracting original HTML from wrapper. Timestamp: ${timestamp}, Original URL: ${originalUrl}`);

      // Try multiple strategies to get original HTML
      const cheerio = await import('cheerio');
      const cheerioModule = cheerio.default || cheerio;
      const $ = cheerioModule.load(wrapperHtml);

      // Strategy 1: Try iframe#playback src directly
      const iframe = $('#playback');
      if (iframe.length > 0) {
        const iframeSrc = iframe.attr('src');
        console.log(`[Wayback] Found iframe#playback with src: ${iframeSrc}`);
        
        if (iframeSrc) {
          // Try to fetch iframe src directly (may be absolute or relative)
          let iframeUrl = iframeSrc;
          if (!iframeSrc.startsWith('http')) {
            iframeUrl = `https://web.archive.org${iframeSrc}`;
          }
          
          try {
            console.log(`[Wayback] Fetching iframe src: ${iframeUrl}`);
            const iframeResponse = await this.createFetchWithTimeout(iframeUrl, {
              headers: {
                'User-Agent': 'WebScraper-MVP/1.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              },
            });

            if (iframeResponse && iframeResponse.ok) {
              const iframeHtml = await iframeResponse.text();
              console.log(`[Wayback] Fetched HTML from iframe: ${iframeHtml.length} bytes`);
              
              // Verify we got actual content
              if (iframeHtml && iframeHtml.length > 100 && !this.isWaybackWrapperHtml(iframeHtml)) {
                console.log(`[Wayback] Successfully extracted original HTML from iframe (${iframeHtml.length} bytes)`);
                return iframeHtml;
              } else {
                console.warn(`[Wayback] Iframe HTML appears to be wrapper or too short (${iframeHtml.length} bytes)`);
              }
            }
          } catch (iframeError) {
            console.warn(`[Wayback] Failed to fetch iframe src: ${iframeError.message}`);
          }
        }
      } else {
        console.warn('[Wayback] iframe#playback not found in wrapper HTML');
      }

      // Strategy 2: Try raw URL with id_ flag
      const rawUrl = `https://web.archive.org/web/${timestamp}id_/${originalUrl}`;
      console.log(`[Wayback] Trying raw URL: ${rawUrl}`);
      
      try {
        const rawResponse = await this.createFetchWithTimeout(rawUrl, {
          headers: {
            'User-Agent': 'WebScraper-MVP/1.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        if (rawResponse && rawResponse.ok) {
          const rawHtml = await rawResponse.text();
          console.log(`[Wayback] Fetched HTML from raw URL: ${rawHtml.length} bytes`);
          
          // Verify we got actual content, not another wrapper
          if (rawHtml && rawHtml.length > 100 && !this.isWaybackWrapperHtml(rawHtml)) {
            console.log(`[Wayback] Successfully extracted original HTML from raw URL (${rawHtml.length} bytes)`);
            return rawHtml;
          } else {
            console.warn(`[Wayback] Raw URL HTML appears to be wrapper or too short (${rawHtml.length} bytes)`);
          }
        } else {
          console.warn(`[Wayback] Raw URL returned HTTP ${rawResponse?.status || 'Unknown'}`);
        }
      } catch (rawError) {
        console.warn(`[Wayback] Failed to fetch raw URL: ${rawError.message}`);
      }

      // Strategy 3: Try extracting content from wrapper HTML directly
      // Look for content in common Wayback wrapper structures
      const contentSelectors = [
        '#wm-ipp-base + iframe',
        'iframe[src*="/web/"]',
        '#playback',
      ];
      
      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          const src = element.attr('src');
          if (src) {
            let contentUrl = src;
            if (!contentUrl.startsWith('http')) {
              contentUrl = `https://web.archive.org${contentUrl}`;
            }
            
            try {
              console.log(`[Wayback] Trying content URL from selector ${selector}: ${contentUrl}`);
              const contentResponse = await this.createFetchWithTimeout(contentUrl, {
                headers: {
                  'User-Agent': 'WebScraper-MVP/1.0',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
              });
              
              if (contentResponse && contentResponse.ok) {
                const contentHtml = await contentResponse.text();
                if (contentHtml && contentHtml.length > 100 && !this.isWaybackWrapperHtml(contentHtml)) {
                  console.log(`[Wayback] Successfully extracted HTML from ${selector} (${contentHtml.length} bytes)`);
                  return contentHtml;
                }
              }
            } catch (contentError) {
              console.warn(`[Wayback] Failed to fetch content from ${selector}: ${contentError.message}`);
            }
          }
        }
      }

      // Final fallback: return original wrapper HTML
      console.warn('[Wayback] Could not extract original HTML, returning wrapper as fallback');
      return wrapperHtml;
    } catch (error) {
      console.error('[Wayback] Error extracting original HTML from Wayback wrapper:', error);
      // Safe fallback: return original HTML
      return wrapperHtml;
    }
  }

  /**
   * Fetch HTML for a specific snapshot with retry logic for rate limiting
   * 
   * Strategy:
   * 1. Check in-memory cache first
   * 2. Try raw URL (id_ flag) for direct access to original HTML
   * 3. If raw fails (404 or error), try wrapper URL
   * 4. If wrapper is detected, extract original HTML from iframe
   * 5. Cache successful results
   * 
   * @param {object} snapshot - Snapshot object with timestamp and originalUrl
   * @param {number} retryCount - Current retry attempt (internal)
   * @param {number} maxRetries - Maximum number of retries for rate limiting
   * @returns {Promise<{html: string, length: number, snapshotUrl: string}>}
   */
  async getSnapshotHtml(snapshot, retryCount = 0, maxRetries = 3) {
    const { timestamp, originalUrl } = snapshot;
    
    if (!timestamp || !originalUrl) {
      throw new Error('Snapshot must have timestamp and originalUrl');
    }

    // Check cache first
    const cacheKey = `${timestamp}|${originalUrl}`;
    const cached = this.snapshotCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const snapshotUrl = this.buildSnapshotUrl(timestamp, originalUrl);
    const rawUrl = `https://web.archive.org/web/${timestamp}id_/${originalUrl}`;
    
    const fetchHeaders = {
      'User-Agent': 'WebScraper-MVP/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    try {
      // Strategy 1: Try raw URL first (direct access to original HTML)
      let rawResponse;
      try {
        rawResponse = await this.createFetchWithTimeout(rawUrl, {
          headers: fetchHeaders,
        });

        // Handle rate limiting (429)
        if (rawResponse && rawResponse.status === 429) {
          if (retryCount < maxRetries) {
            const delay = this.getBackoffDelay(retryCount);
            console.warn(`Rate limited (429) fetching snapshot. Waiting ${delay/1000}s before retry ${retryCount + 1}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return await this.getSnapshotHtml(snapshot, retryCount + 1, maxRetries);
          } else {
            throw new Error(`Rate limit exceeded after ${maxRetries} retries. Please try again later.`);
          }
        }

        // If raw URL works, use it directly
        if (rawResponse && rawResponse.ok) {
          const html = await rawResponse.text();
          console.log(`[Wayback] Raw URL returned HTML (${html.length} bytes)`);
          
          // Verify it's not a wrapper
          let finalHtml = html;
          if (this.isWaybackWrapperHtml(html)) {
            console.log(`[Wayback] Raw URL HTML is a wrapper, extracting original...`);
            const extracted = await this.extractOriginalHtmlFromWaybackWrapper(html, rawUrl);
            if (extracted && extracted !== html && extracted.trim().length > 100) {
              finalHtml = extracted;
              console.log(`[Wayback] Successfully extracted from raw wrapper (${finalHtml.length} bytes)`);
            }
          }

          const result = {
            html: finalHtml,
            length: finalHtml.length,
            snapshotUrl: snapshotUrl,
          };

          // Cache successful result
          this.snapshotCache.set(cacheKey, result);
          return result;
        }

        // If raw URL returns 404 or other error, fall through to wrapper URL
        if (rawResponse && rawResponse.status === 404) {
          // 404 is expected for some snapshots, continue to wrapper strategy
        } else if (rawResponse && !rawResponse.ok) {
          // Other errors - log but continue to wrapper strategy
          console.warn(`Raw URL returned HTTP ${rawResponse.status}, trying wrapper URL`);
        }
      } catch (rawError) {
        // Network errors, timeouts, etc. - continue to wrapper strategy
        if (!rawError.message.includes('timeout')) {
          console.warn(`Raw URL fetch failed: ${rawError.message}, trying wrapper URL`);
        } else {
          throw rawError; // Timeout is fatal
        }
      }

      // Strategy 2: Try wrapper URL
      let wrapperResponse;
      try {
        wrapperResponse = await this.createFetchWithTimeout(snapshotUrl, {
          headers: fetchHeaders,
        });

        // Handle rate limiting (429)
        if (wrapperResponse && wrapperResponse.status === 429) {
          if (retryCount < maxRetries) {
            const delay = this.getBackoffDelay(retryCount);
            console.warn(`Rate limited (429) fetching snapshot wrapper. Waiting ${delay/1000}s before retry ${retryCount + 1}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return await this.getSnapshotHtml(snapshot, retryCount + 1, maxRetries);
          } else {
            throw new Error(`Rate limit exceeded after ${maxRetries} retries. Please try again later.`);
          }
        }

        if (!wrapperResponse || !wrapperResponse.ok) {
          const status = wrapperResponse ? wrapperResponse.status : 'Unknown';
          throw new Error(`Failed to fetch snapshot HTML (HTTP ${status}) for ${snapshotUrl}`);
        }

        let html = await wrapperResponse.text();

        // Extract original HTML if this is a wrapper
        if (this.isWaybackWrapperHtml(html)) {
          console.log(`[Wayback] Detected Wayback wrapper (${html.length} bytes), extracting original HTML...`);
          const extractedHtml = await this.extractOriginalHtmlFromWaybackWrapper(html, snapshotUrl);
          
          // Verify extracted HTML is valid and different from wrapper
          if (extractedHtml && extractedHtml.trim().length > 100 && extractedHtml !== html) {
            html = extractedHtml;
            console.log(`[Wayback] Successfully extracted original HTML (${html.length} bytes)`);
          } else {
            console.warn(`[Wayback] Extracted HTML invalid or same as wrapper (length: ${extractedHtml?.length || 0}), keeping wrapper`);
          }
        } else {
          console.log(`[Wayback] HTML does not appear to be a wrapper (${html.length} bytes)`);
        }

        const result = {
          html: html,
          length: html.length,
          snapshotUrl: snapshotUrl,
        };

        // Cache successful result
        this.snapshotCache.set(cacheKey, result);
        return result;
      } catch (wrapperError) {
        // If wrapper also fails, throw with clear message
        const status = wrapperResponse ? wrapperResponse.status : 'Unknown';
        throw new Error(`Failed to fetch snapshot HTML (HTTP ${status}) for ${snapshotUrl}: ${wrapperError.message}`);
      }
    } catch (error) {
      // Propagate timeout and other errors with clear messages
      if (error.message.includes('timeout')) {
        throw error; // Already formatted
      }
      throw new Error(`Failed to fetch snapshot HTML: ${error.message}`);
    }
  }
}

