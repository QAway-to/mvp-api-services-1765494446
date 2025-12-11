// Topic Analyzer - detects thematic shifts and red flags in domain history
// Analyzes title, headings, meta tags, and content topics across time

/**
 * Extract topic keywords from HTML content
 * @param {string} html - HTML content
 * @returns {Promise<Object>} - Topic analysis { title, headings, keywords, description }
 */
export async function extractTopics(html) {
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
    
    // Extract title
    const title = $('title').text().trim() || '';
    
    // Extract headings (h1-h6)
    const headings = [];
    $('h1, h2, h3').each((i, el) => {
      const text = $(el).text().trim();
      if (text) {
        headings.push({
          level: el.tagName.toLowerCase(),
          text: text,
        });
      }
    });
    
    // Extract meta tags
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogDescription = $('meta[property="og:description"]').attr('content') || '';
    
    // Extract main content keywords (first 500 words)
    const bodyText = $('body').text() || '';
    const words = bodyText
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 500)
      .map(w => w.toLowerCase().replace(/[^a-z0-9а-яё]/gi, ''));
    
    return {
      title,
      headings,
      metaDescription,
      metaKeywords,
      ogTitle,
      ogDescription,
      contentWords: words,
    };
  } catch (error) {
    console.error('Error extracting topics:', error);
    return {
      title: '',
      headings: [],
      metaDescription: '',
      metaKeywords: '',
      ogTitle: '',
      ogDescription: '',
      contentWords: [],
    };
  }
}

/**
 * Extract keywords from text using simple frequency analysis
 * @param {Array<string>} words - Array of words
 * @param {number} topN - Number of top keywords to return
 * @returns {Array} - Array of { word, frequency }
 */
function extractKeywords(words, topN = 10) {
  const wordFreq = {};
  
  words.forEach(word => {
    if (word && word.length > 3) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });
  
  return Object.entries(wordFreq)
    .map(([word, freq]) => ({ word, frequency: freq }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, topN);
}

/**
 * Calculate similarity between two topic sets
 * @param {Object} topics1 - First topic set
 * @param {Object} topics2 - Second topic set
 * @returns {number} - Similarity score 0-100
 */
function calculateTopicSimilarity(topics1, topics2) {
  let similarity = 0;
  let factors = 0;
  
  // Compare titles
  if (topics1.title && topics2.title) {
    const titleSimilarity = calculateTextSimilarity(topics1.title, topics2.title);
    similarity += titleSimilarity;
    factors++;
  }
  
  // Compare headings (average)
  if (topics1.headings.length > 0 && topics2.headings.length > 0) {
    const headings1 = topics1.headings.map(h => h.text.toLowerCase());
    const headings2 = topics2.headings.map(h => h.text.toLowerCase());
    const headingsSimilarity = calculateArraySimilarity(headings1, headings2);
    similarity += headingsSimilarity;
    factors++;
  }
  
  // Compare meta descriptions
  if (topics1.metaDescription && topics2.metaDescription) {
    const descSimilarity = calculateTextSimilarity(topics1.metaDescription, topics2.metaDescription);
    similarity += descSimilarity;
    factors++;
  }
  
  // Compare content keywords
  if (topics1.contentWords.length > 0 && topics2.contentWords.length > 0) {
    const keywords1 = extractKeywords(topics1.contentWords, 20).map(k => k.word);
    const keywords2 = extractKeywords(topics2.contentWords, 20).map(k => k.word);
    const keywordsSimilarity = calculateArraySimilarity(keywords1, keywords2);
    similarity += keywordsSimilarity;
    factors++;
  }
  
  return factors > 0 ? Math.round(similarity / factors) : 0;
}

/**
 * Simple text similarity using Jaccard index
 */
function calculateTextSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
}

/**
 * Array similarity using Jaccard index
 */
function calculateArraySimilarity(arr1, arr2) {
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
}

/**
 * Detect red flags in topic analysis
 * @param {Object} topics - Current topic analysis
 * @param {Array<Object>} history - Historical topic analyses
 * @returns {Array} - Array of red flags
 */
function detectRedFlags(topics, history = []) {
  const flags = [];
  
  // Flag 1: Very short or missing title
  if (!topics.title || topics.title.length < 10) {
    flags.push({
      type: 'missing_title',
      severity: 'medium',
      message: 'Missing or very short title tag',
    });
  }
  
  // Flag 2: Suspicious keywords in title/headings
  const suspiciousKeywords = ['casino', 'poker', 'viagra', 'loan', 'payday', 'free money', 'get rich'];
  const allText = `${topics.title} ${topics.metaDescription} ${topics.headings.map(h => h.text).join(' ')}`.toLowerCase();
  
  suspiciousKeywords.forEach(keyword => {
    if (allText.includes(keyword)) {
      flags.push({
        type: 'suspicious_keyword',
        severity: 'high',
        message: `Suspicious keyword found: ${keyword}`,
        keyword,
      });
    }
  });
  
  // Flag 3: Topic shift detection
  if (history.length > 0) {
    const recentSimilarity = calculateTopicSimilarity(topics, history[history.length - 1]);
    if (recentSimilarity < 30) {
      flags.push({
        type: 'major_topic_shift',
        severity: 'high',
        message: `Major topic shift detected (similarity: ${recentSimilarity}%)`,
        similarity: recentSimilarity,
      });
    }
  }
  
  // Flag 4: Multiple topic shifts over time
  if (history.length > 2) {
    let shifts = 0;
    for (let i = 1; i < history.length; i++) {
      const similarity = calculateTopicSimilarity(history[i - 1], history[i]);
      if (similarity < 40) {
        shifts++;
      }
    }
    
    if (shifts > history.length / 2) {
      flags.push({
        type: 'unstable_topics',
        severity: 'high',
        message: `Unstable topic history: ${shifts} major shifts detected`,
        shifts,
      });
    }
  }
  
  // Flag 5: Missing meta tags
  if (!topics.metaDescription || topics.metaDescription.length < 50) {
    flags.push({
      type: 'missing_meta',
      severity: 'low',
      message: 'Missing or very short meta description',
    });
  }
  
  return flags;
}

/**
 * Analyze topic stability across snapshots
 * @param {Array<Object>} snapshots - Array of snapshots with HTML
 * @returns {Promise<Object>} - Topic analysis result
 */
export async function analyzeTopicStability(snapshots) {
  const topicAnalyses = [];
  
  // Extract topics from each snapshot
  for (const snapshot of snapshots) {
    if (snapshot.html) {
      const topics = await extractTopics(snapshot.html);
      topicAnalyses.push({
        timestamp: snapshot.timestamp,
        topics,
      });
    }
  }
  
  if (topicAnalyses.length === 0) {
    return {
      snapshotsAnalyzed: 0,
      stabilityScore: null,
      redFlags: [],
      topicHistory: [],
    };
  }
  
  // Calculate stability score (average similarity between consecutive snapshots)
  let totalSimilarity = 0;
  let comparisons = 0;
  
  for (let i = 1; i < topicAnalyses.length; i++) {
    const similarity = calculateTopicSimilarity(
      topicAnalyses[i - 1].topics,
      topicAnalyses[i].topics
    );
    totalSimilarity += similarity;
    comparisons++;
  }
  
  const stabilityScore = comparisons > 0 ? Math.round(totalSimilarity / comparisons) : 100;
  
  // Detect red flags from latest snapshot
  const latestTopics = topicAnalyses[topicAnalyses.length - 1].topics;
  const history = topicAnalyses.map(ta => ta.topics);
  const redFlags = detectRedFlags(latestTopics, history.slice(0, -1));
  
  // Extract main topics from latest snapshot
  const mainTopics = extractKeywords(latestTopics.contentWords, 10);
  
  return {
    snapshotsAnalyzed: topicAnalyses.length,
    stabilityScore,
    redFlags,
    mainTopics: mainTopics.map(t => t.word),
    topicHistory: topicAnalyses.map(ta => ({
      timestamp: ta.timestamp,
      title: ta.topics.title,
      keywords: extractKeywords(ta.topics.contentWords, 5).map(k => k.word),
    })),
    latestTopics: {
      title: latestTopics.title,
      headings: latestTopics.headings.map(h => h.text),
      metaDescription: latestTopics.metaDescription,
    },
  };
}

