// HTML Parser for spam detection
// Extracts text content from HTML and checks for stop words

/**
 * Extract text content from HTML (removes scripts, styles, etc.)
 * @param {string} html - HTML content
 * @param {string} domainToIgnore - Optional domain to exclude from text extraction
 */
export async function extractTextContent(html, domainToIgnore = null) {
  try {
    // Dynamic import for cheerio
    const cheerio = await import('cheerio');
    // Handle both ESM and CommonJS exports
    let cheerioModule;
    if (typeof cheerio === 'function') {
      cheerioModule = cheerio;
    } else if (cheerio.default && typeof cheerio.default === 'function') {
      cheerioModule = cheerio.default;
    } else if (cheerio.load) {
      cheerioModule = cheerio;
    } else {
      throw new Error('Cannot load cheerio module');
    }
    const $ = cheerioModule.load(html);
    
    // Remove script, style, and other non-content elements
    $('script, style, noscript, iframe, embed, object').remove();
    
    // Remove domain from href attributes to prevent domain name matching
    if (domainToIgnore) {
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes(domainToIgnore)) {
          $(el).attr('href', '#'); // Replace with placeholder
        }
      });
    }
    
    // Extract text
    let text = $('body').text() || $('html').text();
    
    // Remove domain name from text if provided
    if (domainToIgnore) {
      const domainRegex = new RegExp(domainToIgnore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      text = text.replace(domainRegex, '');
    }
    
    // Clean up whitespace
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
  } catch (error) {
    // Fallback: basic text extraction without cheerio
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                   .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                   .replace(/<[^>]+>/g, ' ')
                   .replace(/\s+/g, ' ')
                   .trim()
                   .toLowerCase();
    
    // Remove domain name if provided
    if (domainToIgnore) {
      const domainRegex = new RegExp(domainToIgnore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      text = text.replace(domainRegex, '');
    }
    
    return text;
  }
}

/**
 * Extract meta tags (description, keywords)
 * @param {string} html - HTML content
 * @param {string} domainToIgnore - Optional domain to exclude from meta tags
 */
export async function extractMetaTags(html, domainToIgnore = null) {
  try {
    const cheerio = await import('cheerio');
    // Handle both ESM and CommonJS exports
    let cheerioModule;
    if (typeof cheerio === 'function') {
      cheerioModule = cheerio;
    } else if (cheerio.default && typeof cheerio.default === 'function') {
      cheerioModule = cheerio.default;
    } else if (cheerio.load) {
      cheerioModule = cheerio;
    } else {
      throw new Error('Cannot load cheerio module');
    }
    const $ = cheerioModule.load(html);
    
    let title = $('title').text().trim() || '';
    let description = $('meta[name="description"]').attr('content') || '';
    let keywords = $('meta[name="keywords"]').attr('content') || '';
    
    // Remove domain name from meta tags if provided
    if (domainToIgnore) {
      const domainRegex = new RegExp(domainToIgnore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      title = title.replace(domainRegex, '').trim();
      description = description.replace(domainRegex, '').trim();
      keywords = keywords.replace(domainRegex, '').trim();
    }
    
    return {
      title: title,
      description: description,
      keywords: keywords,
    };
  } catch (error) {
    return { title: '', description: '', keywords: '' };
  }
}

/**
 * Check text for stop words
 * @param {string} text - Text to check
 * @param {Array<string>} stopWords - Array of stop words (lowercase)
 * @returns {Object} - { found: [], count: number, score: number }
 */
export function checkStopWords(text, stopWords) {
  if (!text || !stopWords || stopWords.length === 0) {
    return { found: [], count: 0, score: 0 };
  }
  
  const found = [];
  const textLower = text.toLowerCase();
  
  stopWords.forEach(word => {
    const wordLower = word.toLowerCase().trim();
    if (wordLower && textLower.includes(wordLower)) {
      // Count occurrences - ИСПРАВЛЕНО: используем textLower вместо text
      const regex = new RegExp(wordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = textLower.match(regex);
      const count = matches ? matches.length : 0;
      
      if (!found.find(item => item.word === wordLower)) {
        found.push({
          word: wordLower,
          count: count,
        });
      }
    }
  });
  
  // Calculate spam score (0-10) based on found words
  // НОВАЯ ФОРМУЛА: простая шкала 0-10
  let score = 0;
  if (found.length > 0) {
    // Базовая оценка: количество уникальных стоп-слов
    score = Math.min(10, found.length * 2); // 1 слово = 2 балла, макс 10
    
    // Бонус за частоту вхождений
    const totalOccurrences = found.reduce((sum, item) => sum + item.count, 0);
    if (totalOccurrences > 10) score = 10; // Много вхождений = максимум
    else if (totalOccurrences > 5) score = Math.min(10, score + 2);
  }
  
  return {
    found: found,
    count: found.length,
    score: Math.round(score * 10) / 10, // Round to 1 decimal
  };
}

/**
 * Analyze HTML content for spam
 * @param {string} html - HTML content
 * @param {Array<string>} stopWords - Array of stop words
 * @param {string} domainToIgnore - Optional domain name to exclude from analysis
 * @returns {Promise<Object>} - Analysis result
 */
export async function analyzeHtmlForSpam(html, stopWords, domainToIgnore = null) {
  const textContent = await extractTextContent(html, domainToIgnore);
  const metaTags = await extractMetaTags(html, domainToIgnore);
  
  // DEBUG: логируем что было извлечено (первые 200 символов)
  if (textContent.length > 0) {
    console.log(`[DEBUG] Extracted text preview (${textContent.length} chars): ${textContent.substring(0, 200)}...`);
  } else {
    console.log(`[DEBUG] WARNING: Extracted text is EMPTY!`);
  }
  
  // Combine all text sources for analysis (excluding meta tags that might contain domain)
  let allText = textContent;
  
  // Only add meta tags if they don't contain the domain name
  if (metaTags.title && (!domainToIgnore || !metaTags.title.toLowerCase().includes(domainToIgnore.toLowerCase()))) {
    allText += ' ' + metaTags.title.toLowerCase();
  }
  if (metaTags.description && (!domainToIgnore || !metaTags.description.toLowerCase().includes(domainToIgnore.toLowerCase()))) {
    allText += ' ' + metaTags.description.toLowerCase();
  }
  if (metaTags.keywords && (!domainToIgnore || !metaTags.keywords.toLowerCase().includes(domainToIgnore.toLowerCase()))) {
    allText += ' ' + metaTags.keywords.toLowerCase();
  }
  
  // DEBUG: логируем финальный текст для поиска (первые 300 символов)
  console.log(`[DEBUG] Final text for analysis (${allText.length} chars): ${allText.substring(0, 300)}...`);
  console.log(`[DEBUG] Searching for stop words: ${stopWords.slice(0, 5).join(', ')}...`);
  console.log(`[DEBUG] Domain to ignore: ${domainToIgnore || 'none'}`);
  
  const stopWordsCheck = checkStopWords(allText, stopWords);
  
  // DEBUG: результат поиска
  if (stopWordsCheck.count > 0) {
    console.log(`[DEBUG] Found stop words: ${stopWordsCheck.found.map(s => `${s.word}(${s.count})`).join(', ')}`);
  } else {
    console.log(`[DEBUG] No stop words found. Text length: ${allText.length}, Stop words count: ${stopWords.length}`);
  }
  
  return {
    textLength: textContent.length,
    metaTags: metaTags,
    stopWords: stopWordsCheck,
    isSpam: stopWordsCheck.count > 0, // Упрощено: любое стоп-слово = спам
    spamScore: stopWordsCheck.score,
  };
}

