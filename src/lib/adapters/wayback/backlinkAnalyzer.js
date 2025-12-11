// Backlink Analyzer - extracts and analyzes links from historical snapshots
// Analyzes anchor text, link quality, and spam indicators

/**
 * Extract all links from HTML
 * @param {string} html - HTML content
 * @returns {Promise<Array>} - Array of link objects { href, anchor, rel, target }
 */
export async function extractLinks(html) {
  try {
    const cheerio = await import('cheerio');
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
    
    const links = [];
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const anchor = $(el).text().trim();
      const rel = $(el).attr('rel') || '';
      const target = $(el).attr('target') || '';
      
      // Only process valid links
      if (href && href !== '#' && href !== 'javascript:void(0)') {
        links.push({
          href: href,
          anchor: anchor,
          rel: rel.toLowerCase(),
          target: target,
          isExternal: href.startsWith('http'),
        });
      }
    });
    
    return links;
  } catch (error) {
    console.error('Error extracting links:', error);
    return [];
  }
}

/**
 * Check if anchor text contains spam keywords
 * @param {string} anchor - Anchor text
 * @param {Array<string>} spamKeywords - Array of spam keywords
 * @returns {Object} - { isSpam: boolean, foundKeywords: Array }
 */
export function checkAnchorSpam(anchor, spamKeywords = []) {
  if (!anchor || !spamKeywords || spamKeywords.length === 0) {
    return { isSpam: false, foundKeywords: [] };
  }
  
  const anchorLower = anchor.toLowerCase();
  const found = [];
  
  spamKeywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase().trim();
    if (keywordLower && anchorLower.includes(keywordLower)) {
      found.push(keywordLower);
    }
  });
  
  return {
    isSpam: found.length > 0,
    foundKeywords: found,
  };
}

/**
 * Analyze link quality indicators
 * @param {Object} link - Link object
 * @returns {Object} - Quality indicators
 */
export function analyzeLinkQuality(link) {
  const indicators = {
    isNofollow: link.rel && link.rel.includes('nofollow'),
    isSponsored: link.rel && link.rel.includes('sponsored'),
    isUgc: link.rel && link.rel.includes('ugc'),
    hasAnchor: link.anchor && link.anchor.length > 0,
    isExternal: link.isExternal,
    anchorLength: link.anchor ? link.anchor.length : 0,
  };
  
  // Calculate quality score (0-100)
  let qualityScore = 100;
  
  if (indicators.isNofollow) qualityScore -= 30;
  if (indicators.isSponsored) qualityScore -= 20;
  if (indicators.isUgc) qualityScore -= 10;
  if (!indicators.hasAnchor) qualityScore -= 15;
  if (indicators.anchorLength > 100) qualityScore -= 10; // Suspiciously long anchor
  if (indicators.anchorLength < 3) qualityScore -= 5; // Very short anchor
  
  indicators.qualityScore = Math.max(0, Math.min(100, qualityScore));
  
  return indicators;
}

/**
 * Analyze backlinks from snapshot HTML
 * @param {string} html - HTML content
 * @param {Array<string>} spamKeywords - Optional spam keywords for anchor text analysis
 * @param {string} domain - Domain being analyzed
 * @returns {Promise<Object>} - Backlink analysis result
 */
export async function analyzeBacklinks(html, spamKeywords = [], domain = null) {
  const links = await extractLinks(html);
  
  // Separate internal and external links
  const internalLinks = [];
  const externalLinks = [];
  
  links.forEach(link => {
    try {
      // Normalize URL to check if it's internal
      let isInternal = false;
      if (domain) {
        const domainRegex = new RegExp(domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        if (link.href.includes(domain) || link.href.startsWith('/') || link.href.startsWith('./')) {
          isInternal = true;
        }
      }
      
      const linkWithQuality = {
        ...link,
        ...analyzeLinkQuality(link),
        ...checkAnchorSpam(link.anchor, spamKeywords),
      };
      
      if (isInternal) {
        internalLinks.push(linkWithQuality);
      } else {
        externalLinks.push(linkWithQuality);
      }
    } catch (e) {
      // Skip invalid links
    }
  });
  
  // Extract domains from external links
  const externalDomains = new Set();
  externalLinks.forEach(link => {
    try {
      if (link.href.startsWith('http')) {
        const url = new URL(link.href);
        externalDomains.add(url.hostname);
      }
    } catch (e) {
      // Skip invalid URLs
    }
  });
  
  // Calculate statistics
  const spamAnchors = externalLinks.filter(l => l.isSpam);
  const nofollowLinks = externalLinks.filter(l => l.isNofollow);
  const averageQuality = externalLinks.length > 0
    ? externalLinks.reduce((sum, l) => sum + l.qualityScore, 0) / externalLinks.length
    : 0;
  
  return {
    totalLinks: links.length,
    internalLinks: internalLinks.length,
    externalLinks: externalLinks.length,
    uniqueExternalDomains: externalDomains.size,
    spamAnchorsCount: spamAnchors.length,
    spamAnchorsPercentage: externalLinks.length > 0 
      ? (spamAnchors.length / externalLinks.length) * 100 
      : 0,
    nofollowLinksCount: nofollowLinks.length,
    nofollowPercentage: externalLinks.length > 0
      ? (nofollowLinks.length / externalLinks.length) * 100
      : 0,
    averageQualityScore: Math.round(averageQuality * 10) / 10,
    links: {
      internal: internalLinks,
      external: externalLinks,
    },
    topExternalDomains: Array.from(externalDomains).slice(0, 10),
  };
}

/**
 * Analyze backlinks across multiple snapshots
 * @param {Array<Object>} snapshots - Array of snapshot objects with HTML
 * @param {Array<string>} spamKeywords - Optional spam keywords
 * @param {string} domain - Domain being analyzed
 * @returns {Promise<Object>} - Combined analysis result
 */
export async function analyzeBacklinksHistory(snapshots, spamKeywords = [], domain = null) {
  const analyses = [];
  
  for (const snapshot of snapshots) {
    if (snapshot.html) {
      const analysis = await analyzeBacklinks(snapshot.html, spamKeywords, domain);
      analyses.push({
        timestamp: snapshot.timestamp,
        ...analysis,
      });
    }
  }
  
  if (analyses.length === 0) {
    return {
      snapshotsAnalyzed: 0,
      averageExternalLinks: 0,
      averageQualityScore: 0,
      spamAnchorsTrend: [],
    };
  }
  
  // Calculate averages and trends
  const averageExternalLinks = analyses.reduce((sum, a) => sum + a.externalLinks, 0) / analyses.length;
  const averageQualityScore = analyses.reduce((sum, a) => sum + a.averageQualityScore, 0) / analyses.length;
  const spamAnchorsTrend = analyses.map(a => ({
    timestamp: a.timestamp,
    percentage: a.spamAnchorsPercentage,
    count: a.spamAnchorsCount,
  }));
  
  return {
    snapshotsAnalyzed: analyses.length,
    averageExternalLinks: Math.round(averageExternalLinks * 10) / 10,
    averageQualityScore: Math.round(averageQualityScore * 10) / 10,
    spamAnchorsTrend,
    analyses,
  };
}

