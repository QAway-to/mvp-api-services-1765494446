// Default stop words for spam detection

export const defaultStopWords = [
  // Gambling/Casino
  'casino', 'poker', 'roulette', 'blackjack', 'betting', 'gambling', 'lottery',
  
  // Adult content
  'viagra', 'cialis', 'porn', 'xxx', 'adult', 'escort',
  
  // Spam/Scam
  'get rich', 'make money fast', 'work from home', 'earn $', 'free money',
  'credit card', 'loan', 'debt', 'payday',
  
  // Phishing
  'verify account', 'confirm identity', 'suspended account', 'click here',
  
  // Pills/Pharmacy
  'buy online', 'no prescription', 'cheap', 'discount',
  
  // Weight loss
  'lose weight', 'miracle', 'guaranteed',
  
  // Tech spam
  'click here', 'download now', 'limited time', 'act now',
];

/**
 * Parse stop words from string (comma-separated or newline-separated)
 */
export function parseStopWords(input) {
  if (!input || typeof input !== 'string') {
    return [];
  }
  
  return input
    .split(/[,\n]/)
    .map(word => word.trim())
    .filter(word => word.length > 0)
    .map(word => word.toLowerCase());
}

/**
 * Combine default stop words with custom ones
 */
export function combineStopWords(customWords = []) {
  const custom = Array.isArray(customWords) 
    ? customWords 
    : parseStopWords(customWords);
  
  const combined = [...new Set([...defaultStopWords, ...custom])];
  return combined;
}

