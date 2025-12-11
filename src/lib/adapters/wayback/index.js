// Wayback Machine adapter
import { WaybackClient } from './waybackClient.js';
import { analyzeHtmlForSpam } from './htmlParser.js';
import { analyzeBacklinksHistory } from './backlinkAnalyzer.js';
import { getDomainMetrics } from './metricsAnalyzer.js';
import { analyzeTopicStability } from './topicAnalyzer.js';

export class WaybackMachineAdapter {
  constructor() {
    this.client = new WaybackClient();
  }

  getName() {
    return 'wayback';
  }

  /**
   * Check if target is valid for Wayback Machine
   */
  canHandle(target) {
    // Wayback Machine can handle any domain/URL
    return typeof target === 'string' && target.trim().length > 0;
  }

  /**
   * Get snapshots from CDX API
   */
  async getSnapshots(target, limit = 10) {
    return await this.client.getSnapshots(target, limit);
  }

  /**
   * Get HTML for a specific snapshot
   */
  async getSnapshotHtml(snapshot) {
    return await this.client.getSnapshotHtml(snapshot);
  }

  /**
   * Test method - fetch snapshots and get first snapshot HTML
   */
  async testWayback(target) {
    try {
      // Get snapshots
      const snapshots = await this.getSnapshots(target, 5);

      if (snapshots.length === 0) {
        return {
          target: target,
          snapshotsCount: 0,
        };
      }

      // Get first snapshot HTML
      const firstSnapshot = snapshots[0];
      const htmlResult = await this.getSnapshotHtml(firstSnapshot);

      return {
        target: target,
        snapshotsCount: snapshots.length,
        firstSnapshotTimestamp: firstSnapshot.timestamp,
        firstSnapshotUrl: firstSnapshot.originalUrl,
        firstSnapshotHtmlLength: htmlResult.length,
        firstSnapshotWaybackUrl: htmlResult.snapshotUrl, // Wayback URL
      };
    } catch (error) {
      throw new Error(`Wayback test failed: ${error.message}`);
    }
  }

  /**
   * Analyze domain for spam content in historical snapshots with status updates
   * @param {string} domain - Domain to analyze
   * @param {Array<string>} stopWords - List of spam keywords
   * @param {number} maxSnapshots - Max snapshots to check (default: 10)
   * @param {Function} progressCallback - Optional callback for progress updates
   * @param {Function} statusCallback - Optional callback for status updates: (status, data) => void
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeDomainForSpam(domain, stopWords = [], maxSnapshots = 10, progressCallback = null, statusCallback = null) {
    const log = (msg) => {
      if (progressCallback) progressCallback(msg);
    };
    
    const updateStatus = (status, data = {}) => {
      if (statusCallback) {
        // Ensure status is always a string
        const normalizedStatus = typeof status === 'string' 
          ? status 
          : (status && typeof status === 'object' ? (status.status || status.label || 'QUEUED') : String(status || 'QUEUED'));
        
        statusCallback({
          domain,
          status: normalizedStatus,
          ...data,
        });
      }
    };

    try {
      // Initial status: FETCHING_SNAPSHOTS
      updateStatus('FETCHING_SNAPSHOTS', { lastMessage: 'Fetching snapshots from CDX API...' });
      log(`Analyzing domain: ${domain}`);
      
      // Extract domain name for exclusion from stop word matching
      let domainName = domain;
      try {
        const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
        domainName = url.hostname;
      } catch (e) {
        // Use domain as-is
        domainName = domain.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      }
      
      // Get snapshots
      let snapshots;
      try {
        snapshots = await this.getSnapshots(domain, maxSnapshots);
      } catch (error) {
        const errorMsg = error.message || String(error);
        log(`❌ Error fetching snapshots: ${errorMsg}`);
        updateStatus('UNAVAILABLE', { 
          lastMessage: `CDX API error: ${errorMsg}`,
          error: errorMsg,
          snapshotsFound: 0,
        });
        return {
          domain: domain,
          status: 'UNAVAILABLE',
          snapshotsFound: 0,
          snapshotsAnalyzed: 0,
          error: errorMsg,
          lastMessage: `CDX API error: ${errorMsg}`,
        };
      }
      
      if (snapshots.length === 0) {
        updateStatus('NO_SNAPSHOTS', { 
          lastMessage: 'No snapshots found in Wayback Machine',
          snapshotsFound: 0,
        });
        return {
          domain: domain,
          status: 'NO_SNAPSHOTS',
          snapshotsFound: 0,
          snapshotsAnalyzed: 0,
          lastMessage: 'No snapshots found in Wayback Machine',
        };
      }

      log(`Found ${snapshots.length} snapshots, analyzing...`);
      updateStatus('ANALYZING', { 
        lastMessage: `Found ${snapshots.length} snapshot(s), analyzing...`,
        snapshotsFound: snapshots.length,
        snapshotsAnalyzed: 0,
      });
      
      let spamSnapshots = 0;
      let totalSpamScore = 0;
      let maxSpamScore = 0;
      let successfullyAnalyzed = 0;
      let failedSnapshots = 0;
      const allFoundStopWords = new Map();
      let firstSpamDate = null;
      const snapshotErrors = [];

      // Analyze each snapshot
      for (let i = 0; i < snapshots.length; i++) {
        const snapshot = snapshots[i];
        try {
          const originalUrlDisplay = snapshot.originalUrl || 'unknown';
          log(`[${i + 1}/${snapshots.length}] Checking snapshot ${originalUrlDisplay} (${snapshot.timestamp})...`);
          
          const htmlResult = await this.getSnapshotHtml(snapshot);
          
          if (!htmlResult || !htmlResult.html) {
            throw new Error('Empty HTML result from snapshot');
          }
          
          log(`[${i + 1}/${snapshots.length}] HTML fetched: ${htmlResult.length} bytes`);
          
          const analysis = await analyzeHtmlForSpam(htmlResult.html, stopWords, domainName);
          
          successfullyAnalyzed++;
          
          // Update max spam score
          if (analysis.spamScore > maxSpamScore) {
            maxSpamScore = analysis.spamScore;
          }
          
          log(`[${i + 1}/${snapshots.length}] Analysis complete: spam=${analysis.isSpam}, score=${analysis.spamScore}, found=${analysis.stopWords.count} stop words`);
          
          if (analysis.isSpam) {
            spamSnapshots++;
            totalSpamScore += analysis.spamScore;
            
            analysis.stopWords.found.forEach(item => {
              const current = allFoundStopWords.get(item.word) || 0;
              allFoundStopWords.set(item.word, current + item.count);
            });
            
            log(`[${i + 1}/${snapshots.length}] ⚠️ SPAM DETECTED: ${analysis.stopWords.found.map(s => s.word).join(', ')}`);
            
            if (!firstSpamDate) {
              firstSpamDate = snapshot.timestamp;
            }
          }
          
          // Update status with progress
          updateStatus('ANALYZING', {
            lastMessage: `Analyzed ${successfullyAnalyzed}/${snapshots.length} snapshots...`,
            snapshotsFound: snapshots.length,
            snapshotsAnalyzed: successfullyAnalyzed,
            maxSpamScore: maxSpamScore,
          });
          
          // Delay between snapshot requests
          if (i < snapshots.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } catch (error) {
          failedSnapshots++;
          const errorMsg = error.message || String(error);
          log(`❌ Error analyzing snapshot ${snapshot.timestamp}: ${errorMsg}`);
          snapshotErrors.push({
            timestamp: snapshot.timestamp,
            originalUrl: snapshot.originalUrl,
            error: errorMsg,
          });
        }
      }

      // Calculate overall spam score
      const avgSpamScore = spamSnapshots > 0 ? totalSpamScore / spamSnapshots : 0;

      // Convert stop words map to array
      const stopWordsFound = Array.from(allFoundStopWords.entries())
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count);

      // Determine status based on maxSpamScore (0-10 scale)
      let finalStatus;
      if (successfullyAnalyzed === 0) {
        finalStatus = 'UNAVAILABLE';
      } else if (maxSpamScore >= 8) {
        finalStatus = 'SPAM';
      } else if (maxSpamScore >= 5) {
        finalStatus = 'SUSPICIOUS';
      } else {
        finalStatus = 'CLEAN';
      }

      const result = {
        domain: domain,
        status: finalStatus,
        snapshotsFound: snapshots.length,
        snapshotsAnalyzed: successfullyAnalyzed,
        failedSnapshots: failedSnapshots,
        spamSnapshots: spamSnapshots,
        maxSpamScore: Math.round(maxSpamScore * 10) / 10,
        avgSpamScore: Math.round(avgSpamScore * 10) / 10,
        spamDetected: spamSnapshots > 0,
        totalStopWordsFound: allFoundStopWords.size,
        stopWordsFound: stopWordsFound,
        firstSpamDate: firstSpamDate,
        lastMessage: finalStatus === 'UNAVAILABLE' 
          ? `Failed to analyze any snapshots. ${failedSnapshots} errors occurred.`
          : `Analysis complete: ${finalStatus}. Max spam score: ${maxSpamScore.toFixed(1)}/10`,
      };
      
      if (snapshotErrors.length > 0) {
        result.snapshotErrors = snapshotErrors;
        if (successfullyAnalyzed === 0) {
          result.error = `Failed to analyze any snapshots. ${failedSnapshots} errors occurred.`;
        }
      }
      
      // Final status update
      updateStatus(finalStatus, result);
      
      return result;
    } catch (error) {
      const errorMsg = error.message || String(error);
      log(`❌ Domain analysis failed: ${errorMsg}`);
      updateStatus('UNAVAILABLE', {
        lastMessage: `Analysis failed: ${errorMsg}`,
        error: errorMsg,
        snapshotsFound: 0,
        snapshotsAnalyzed: 0,
      });
      return {
        domain: domain,
        status: 'UNAVAILABLE',
        snapshotsFound: 0,
        snapshotsAnalyzed: 0,
        error: errorMsg,
        lastMessage: `Analysis failed: ${errorMsg}`,
      };
    }
  }

  /**
   * Analyze multiple domains for spam with parallel processing
   * @param {Array<string>} domains - Array of domains to analyze
   * @param {Array<string>} stopWords - List of spam keywords
   * @param {number} maxSnapshots - Max snapshots per domain
   * @param {Function} progressCallback - Optional callback for progress updates
   * @param {Function} statusCallback - Optional callback for domain status updates: (domainStatus) => void
   * @param {number} maxConcurrent - Max concurrent domain analyses (default: 3)
   * @returns {Promise<Array<Object>>} Array of analysis results
   */
  async analyzeDomainsForSpam(domains, stopWords = [], maxSnapshots = 10, progressCallback = null, statusCallback = null, maxConcurrent = 3) {
    const results = [];
    const domainStatuses = new Map(); // Track status for each domain
    
    // Initialize all domains as QUEUED
    domains.forEach(domain => {
      const trimmed = domain.trim();
      if (!trimmed) return;
      const initialStatus = {
        domain: trimmed,
        status: 'QUEUED',
        lastMessage: 'Waiting to start...',
        snapshotsFound: 0,
        snapshotsAnalyzed: 0,
      };
      domainStatuses.set(trimmed, initialStatus);
      if (statusCallback) {
        statusCallback(initialStatus);
      }
    });
    
    // Process domains in parallel with concurrency limit
    const domainList = domains.map(d => d.trim()).filter(d => d.length > 0);
    const queue = [...domainList];
    const active = new Set();
    const promises = [];
    
    const processDomain = async (domain) => {
      active.add(domain);
      
      const log = (msg) => {
        if (progressCallback) {
          const index = domainList.indexOf(domain) + 1;
          progressCallback(`[${index}/${domainList.length}] ${domain}: ${msg}`);
        }
      };
      
      const statusUpdate = (statusData) => {
        domainStatuses.set(domain, statusData);
        if (statusCallback) {
          statusCallback(statusData);
        }
      };
      
      try {
        const result = await this.analyzeDomainForSpam(domain, stopWords, maxSnapshots, log, statusUpdate);
        results.push(result);
      } catch (error) {
        log(`❌ Error: ${error.message}`);
        const errorResult = {
          domain: domain,
          status: 'UNAVAILABLE',
          error: error.message,
          lastMessage: `Analysis failed: ${error.message}`,
          snapshotsFound: 0,
          snapshotsAnalyzed: 0,
        };
        results.push(errorResult);
        statusUpdate(errorResult);
      } finally {
        active.delete(domain);
        
        // Process next domain from queue
        if (queue.length > 0) {
          const nextDomain = queue.shift();
          promises.push(processDomain(nextDomain));
        }
      }
    };
    
    // Start initial batch
    for (let i = 0; i < Math.min(maxConcurrent, domainList.length); i++) {
      const domain = queue.shift();
      if (domain) {
        promises.push(processDomain(domain));
      }
    }
    
    // Wait for all to complete
    await Promise.all(promises);
    
    // Sort results to match input order
    const sortedResults = domainList.map(domain => {
      return results.find(r => r.domain === domain) || {
        domain: domain,
        status: 'UNAVAILABLE',
        error: 'Analysis not completed',
        snapshotsFound: 0,
        snapshotsAnalyzed: 0,
      };
    });
    
    return sortedResults;
  }

  /**
   * Complete domain analysis - spam, backlinks, topics, metrics
   * @param {string} domain - Domain to analyze
   * @param {Array<string>} stopWords - List of spam keywords
   * @param {number} maxSnapshots - Max snapshots to check (default: 10)
   * @param {Function} progressCallback - Optional callback for progress updates
   * @param {Function} statusCallback - Optional callback for status updates
   * @returns {Promise<Object>} Complete analysis result
   */
  async analyzeDomainComplete(domain, stopWords = [], maxSnapshots = 10, progressCallback = null, statusCallback = null) {
    const log = (msg) => {
      if (progressCallback) progressCallback(msg);
    };
    
    const updateStatus = (status, data = {}) => {
      if (statusCallback) {
        // Ensure status is always a string
        const normalizedStatus = typeof status === 'string' 
          ? status 
          : (status && typeof status === 'object' ? (status.status || status.label || 'QUEUED') : String(status || 'QUEUED'));
        
        statusCallback({
          domain,
          status: normalizedStatus,
          ...data,
        });
      }
    };

    try {
      log(`Starting complete analysis for ${domain}...`);
      updateStatus('FETCHING_SNAPSHOTS', { lastMessage: 'Fetching historical snapshots...' });

      // Step 1: Get snapshots and analyze spam
      const snapshots = await this.client.getSnapshots(domain, maxSnapshots);
      
      updateStatus('ANALYZING_SPAM', { 
        lastMessage: `Analyzing spam content in ${snapshots.length} snapshot(s)...`,
        snapshotsFound: snapshots.length,
      });
      
      if (snapshots.length === 0) {
        return {
          domain,
          status: 'NO_SNAPSHOTS',
          error: 'No snapshots found',
          snapshotsFound: 0,
        };
      }

      // Fetch HTML for all snapshots (for backlink and topic analysis)
      const snapshotsWithHtml = [];
      for (let i = 0; i < snapshots.length; i++) {
        const snapshot = snapshots[i];
        try {
          const htmlResult = await this.client.getSnapshotHtml(snapshot);
          snapshotsWithHtml.push({
            ...snapshot,
            html: htmlResult.html,
          });
          log(`Fetched HTML for snapshot ${i + 1}/${snapshots.length}`);
        } catch (error) {
          log(`Failed to fetch HTML for snapshot ${snapshot.timestamp}: ${error.message}`);
        }
      }

      // Step 2: Spam analysis
      log('Analyzing spam content...');
      const spamAnalysis = await this.analyzeDomainForSpam(domain, stopWords, maxSnapshots, log, updateStatus);

      // Step 3: Backlink analysis
      log('Analyzing backlinks...');
      updateStatus('ANALYZING_BACKLINKS', { lastMessage: 'Analyzing backlink profile...' });
      const backlinkAnalysis = await analyzeBacklinksHistory(snapshotsWithHtml, stopWords, domain);

      // Step 4: Topic analysis
      log('Analyzing topic stability...');
      updateStatus('ANALYZING_TOPICS', { lastMessage: 'Analyzing topic shifts...' });
      const topicAnalysis = await analyzeTopicStability(snapshotsWithHtml);

      // Step 5: Metrics analysis
      log('Fetching domain metrics...');
      updateStatus('ANALYZING_METRICS', { lastMessage: 'Fetching domain metrics...' });
      const metrics = await getDomainMetrics(domain, backlinkAnalysis);

      // Calculate overall risk score (0-100) with clear logic
      const riskFactors = [];
      
      // 1. Spam score (0-100, higher = worse)
      const spamRisk = (spamAnalysis && typeof spamAnalysis.maxSpamScore === 'number' && isFinite(spamAnalysis.maxSpamScore))
        ? Math.min(100, Math.max(0, spamAnalysis.maxSpamScore * 10))
        : null;
      if (spamRisk !== null && spamRisk >= 0) {
        riskFactors.push({ name: 'Spam Content', value: spamRisk, weight: 0.35 });
      }
      
      // 2. Backlink quality (invert: 0 = bad, 100 = good -> 100 = bad, 0 = good)
      const backlinkRisk = (backlinkAnalysis && typeof backlinkAnalysis.averageQualityScore === 'number' && isFinite(backlinkAnalysis.averageQualityScore))
        ? Math.min(100, Math.max(0, 100 - backlinkAnalysis.averageQualityScore))
        : null;
      if (backlinkRisk !== null && backlinkRisk >= 0) {
        riskFactors.push({ name: 'Backlink Quality', value: backlinkRisk, weight: 0.25 });
      }
      
      // 3. Domain metrics (invert: low metrics = high risk)
      const metricsRisk = (metrics && typeof metrics.overallQualityScore === 'number' && isFinite(metrics.overallQualityScore))
        ? Math.min(100, Math.max(0, 100 - metrics.overallQualityScore))
        : null;
      if (metricsRisk !== null && metricsRisk >= 0) {
        riskFactors.push({ name: 'Domain Metrics', value: metricsRisk, weight: 0.25 });
      }
      
      // 4. Topic stability (invert: low stability = high risk)
      const topicRisk = (topicAnalysis && typeof topicAnalysis.stabilityScore === 'number' && isFinite(topicAnalysis.stabilityScore))
        ? Math.min(100, Math.max(0, 100 - topicAnalysis.stabilityScore))
        : null;
      if (topicRisk !== null && topicRisk >= 0) {
        riskFactors.push({ name: 'Topic Stability', value: topicRisk, weight: 0.15 });
      }
      
      // Calculate weighted average risk score
      let overallRiskScore = 0;
      let totalWeight = 0;
      
      riskFactors.forEach(factor => {
        overallRiskScore += factor.value * factor.weight;
        totalWeight += factor.weight;
      });
      
      // Add red flags penalty (separate from weighted average)
      let redFlagPenalty = 0;
      if (topicAnalysis.redFlags && topicAnalysis.redFlags.length > 0) {
        redFlagPenalty = topicAnalysis.redFlags.reduce((sum, flag) => {
          if (flag.severity === 'high') return sum + 15;
          if (flag.severity === 'medium') return sum + 8;
          return sum + 3;
        }, 0);
        // Cap red flag penalty at 30
        redFlagPenalty = Math.min(30, redFlagPenalty);
      }
      
      // Normalize and add penalty
      if (totalWeight > 0) {
        overallRiskScore = Math.round((overallRiskScore / totalWeight) + redFlagPenalty);
      } else {
        // If no factors available, use spam analysis only
        overallRiskScore = spamRisk !== null ? Math.round(spamRisk + redFlagPenalty) : 0;
      }
      
      // Cap at 100 and ensure it's a valid number
      overallRiskScore = Math.min(100, Math.max(0, overallRiskScore));
      
      // Handle NaN/Infinity cases
      if (!isFinite(overallRiskScore) || isNaN(overallRiskScore)) {
        // Fallback: use spam score or default to 50 (medium risk)
        overallRiskScore = spamRisk !== null && isFinite(spamRisk) 
          ? Math.min(100, Math.max(0, Math.round(spamRisk + redFlagPenalty)))
          : 50;
      }
      
      // Determine recommendation based on clear criteria
      let recommendation = 'REVIEW';
      let recommendationReason = [];
      
      // Ensure overallRiskScore is valid before using in messages
      const validRiskScore = isFinite(overallRiskScore) && !isNaN(overallRiskScore) ? overallRiskScore : 50;
      
      // Critical issues - always AVOID
      if (spamRisk !== null && isFinite(spamRisk) && spamRisk >= 80) {
        recommendation = 'AVOID';
        recommendationReason.push('Very high spam score detected');
      } else if (spamRisk !== null && isFinite(spamRisk) && spamRisk >= 50) {
        recommendation = 'AVOID';
        recommendationReason.push('High spam content detected');
      } else if (redFlagPenalty >= 20) {
        recommendation = 'AVOID';
        recommendationReason.push('Multiple high-severity red flags detected');
      }
      // High risk
      else if (validRiskScore >= 70) {
        recommendation = 'AVOID';
        recommendationReason.push(`High overall risk score (${Math.round(validRiskScore)})`);
      } else if (validRiskScore >= 55) {
        recommendation = 'CAUTION';
        recommendationReason.push(`Elevated risk score (${Math.round(validRiskScore)})`);
      } else if (validRiskScore >= 40) {
        recommendation = 'REVIEW';
        recommendationReason.push(`Moderate risk (${Math.round(validRiskScore)}) - review carefully`);
      } else if (validRiskScore >= 25) {
        recommendation = 'REVIEW';
        recommendationReason.push(`Low-moderate risk (${Math.round(validRiskScore)})`);
      } else {
        recommendation = 'BUY';
        recommendationReason.push(`Low risk score (${Math.round(validRiskScore)})`);
      }
      
      // Additional factors for recommendation
      if (metricsRisk !== null && metricsRisk > 70) {
        recommendation = recommendation === 'BUY' ? 'REVIEW' : recommendation;
        if (recommendationReason.length === 1 && recommendationReason[0].includes('Low risk')) {
          recommendationReason.push('Poor domain metrics detected');
        }
      }
      
      if (backlinkRisk !== null && backlinkRisk > 60) {
        recommendation = recommendation === 'BUY' ? 'REVIEW' : recommendation;
        if (recommendationReason.length === 1 && recommendationReason[0].includes('Low risk')) {
          recommendationReason.push('Low backlink quality detected');
        }
      }
      
      // Determine risk level (must match recommendation) - use validRiskScore
      let riskLevel = 'LOW';
      if (validRiskScore >= 70 || recommendation === 'AVOID') {
        riskLevel = 'HIGH';
      } else if (validRiskScore >= 40 || recommendation === 'CAUTION') {
        riskLevel = 'MEDIUM';
      } else {
        riskLevel = 'LOW';
      }
      
      // Ensure consistency: if recommendation is AVOID but risk is LOW, fix it
      if (recommendation === 'AVOID' && riskLevel === 'LOW') {
        riskLevel = 'HIGH';
      }
      
      // Update overallRiskScore with valid value for return
      overallRiskScore = validRiskScore;

      log(`Complete analysis finished for ${domain}`);
      const reasonText = recommendationReason.join('; ');
      
      // Extract snapshot counts from spam analysis
      const snapshotsFound = (spamAnalysis && typeof spamAnalysis.snapshotsFound === 'number') 
        ? spamAnalysis.snapshotsFound 
        : snapshots.length || 0;
      const snapshotsAnalyzed = (spamAnalysis && typeof spamAnalysis.snapshotsAnalyzed === 'number') 
        ? spamAnalysis.snapshotsAnalyzed 
        : 0;
      
      updateStatus('COMPLETE', {
        lastMessage: `Analysis complete. Risk: ${riskLevel}, Recommendation: ${recommendation}. ${reasonText}`,
        overallRiskScore,
        recommendation,
        recommendationReason: reasonText,
        riskFactors,
        snapshotsFound,
        snapshotsAnalyzed,
        maxSpamScore: (spamAnalysis && typeof spamAnalysis.maxSpamScore === 'number') ? spamAnalysis.maxSpamScore : undefined,
        avgSpamScore: (spamAnalysis && typeof spamAnalysis.avgSpamScore === 'number') ? spamAnalysis.avgSpamScore : undefined,
        spamSnapshots: (spamAnalysis && typeof spamAnalysis.spamSnapshots === 'number') ? spamAnalysis.spamSnapshots : undefined,
      });

      return {
        domain,
        status: 'COMPLETE',
        spamAnalysis,
        backlinkAnalysis,
        topicAnalysis,
        metrics,
        overallRiskScore,
        riskLevel,
        recommendation,
        recommendationReason: reasonText,
        riskFactors: riskFactors.map(f => ({ name: f.name, risk: f.value })),
        snapshotsFound,
        snapshotsAnalyzed,
        maxSpamScore: (spamAnalysis && typeof spamAnalysis.maxSpamScore === 'number') ? spamAnalysis.maxSpamScore : undefined,
        avgSpamScore: (spamAnalysis && typeof spamAnalysis.avgSpamScore === 'number') ? spamAnalysis.avgSpamScore : undefined,
        spamSnapshots: (spamAnalysis && typeof spamAnalysis.spamSnapshots === 'number') ? spamAnalysis.spamSnapshots : undefined,
        analyzedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error.message || String(error);
      log(`❌ Complete analysis failed: ${errorMsg}`);
      updateStatus('UNAVAILABLE', {
        lastMessage: `Analysis failed: ${errorMsg}`,
        error: errorMsg,
      });
      return {
        domain,
        status: 'UNAVAILABLE',
        error: errorMsg,
      };
    }
  }

  /**
   * Analyze multiple domains with complete analysis
   * @param {Array<string>} domains - Array of domains
   * @param {Array<string>} stopWords - List of spam keywords
   * @param {number} maxSnapshots - Max snapshots per domain
   * @param {Function} progressCallback - Optional callback
   * @param {Function} statusCallback - Optional callback for domain status updates
   * @param {number} maxConcurrent - Max concurrent analyses (default: 2 - slower due to API calls)
   * @returns {Promise<Array<Object>>} Array of complete analysis results
   */
  async analyzeDomainsComplete(domains, stopWords = [], maxSnapshots = 10, progressCallback = null, statusCallback = null, maxConcurrent = 2) {
    const results = [];
    const domainList = domains.map(d => d.trim()).filter(d => d.length > 0);
    const queue = [...domainList];
    const active = new Set();
    const promises = [];

    const processDomain = async (domain) => {
      active.add(domain);
      
      const log = (msg) => {
        if (progressCallback) {
          const index = domainList.indexOf(domain) + 1;
          progressCallback(`[${index}/${domainList.length}] ${domain}: ${msg}`);
        }
      };
      
      const statusUpdate = (statusData) => {
        if (statusCallback) {
          statusCallback(statusData);
        }
      };
      
      try {
        const result = await this.analyzeDomainComplete(domain, stopWords, maxSnapshots, log, statusUpdate);
        results.push(result);
      } catch (error) {
        log(`❌ Error: ${error.message}`);
        results.push({
          domain: domain,
          status: 'UNAVAILABLE',
          error: error.message,
        });
        statusUpdate({
          domain,
          status: 'UNAVAILABLE',
          error: error.message,
        });
      } finally {
        active.delete(domain);
        
        if (queue.length > 0) {
          const nextDomain = queue.shift();
          promises.push(processDomain(nextDomain));
        }
      }
    };

    // Start initial batch
    for (let i = 0; i < Math.min(maxConcurrent, domainList.length); i++) {
      const domain = queue.shift();
      if (domain) {
        promises.push(processDomain(domain));
      }
    }

    await Promise.all(promises);

    // Sort results to match input order
    return domainList.map(domain => {
      return results.find(r => r.domain === domain) || {
        domain: domain,
        status: 'UNAVAILABLE',
        error: 'Analysis not completed',
      };
    });
  }
}

// Export singleton instance
export const waybackAdapter = new WaybackMachineAdapter();

