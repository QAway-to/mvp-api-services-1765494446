import { useState } from 'react';

const DEFAULT_DOMAINS = `888casino.com
paydayloan.com
sp.freehat.cc
example.com
wikipedia.org
poker.com
loans.com
online-casino.com
betting.com
test.com`;

const DEFAULT_STOP_WORDS = `casino
poker
roulette
blackjack
betting
loan
payday
bonus
jackpot
картман`;

export default function SpamAnalysisForm({ onAnalyze, isLoading }) {
  const [domains, setDomains] = useState(DEFAULT_DOMAINS);
  const [stopWords, setStopWords] = useState(DEFAULT_STOP_WORDS);
  const [maxSnapshots, setMaxSnapshots] = useState(10);
  const [analysisMode, setAnalysisMode] = useState('spam'); // 'spam' or 'complete'

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!domains.trim()) {
      return;
    }

    // Parse domains (one per line)
    const domainList = domains
      .split('\n')
      .map(d => d.trim())
      .filter(d => d.length > 0);

    if (domainList.length === 0) {
      return;
    }

    onAnalyze({
      domains: domainList,
      stopWords: stopWords.trim() || null,
      maxSnapshots: parseInt(maxSnapshots) || 10,
      analysisMode: analysisMode,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', boxSizing: 'border-box' }}>
      <div className="form-group">
        <label className="form-label">
          Domains to Analyze (one per line)
        </label>
        <textarea
          value={domains}
          onChange={(e) => setDomains(e.target.value)}
          placeholder="example.com&#10;test-domain.com&#10;another-domain.org"
          className="form-textarea"
          rows="6"
          required
          disabled={isLoading}
          style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          Custom Stop Words (optional, comma or newline separated)
        </label>
        <textarea
          value={stopWords}
          onChange={(e) => setStopWords(e.target.value)}
          placeholder="casino, viagra, porn, get rich fast"
          className="form-textarea"
          rows="3"
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          Max Snapshots per Domain
        </label>
        <input
          type="number"
          value={maxSnapshots}
          onChange={(e) => setMaxSnapshots(e.target.value)}
          min="1"
          max="50"
          className="form-input"
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Analysis Mode</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px', borderRadius: '8px', background: analysisMode === 'spam' ? 'rgba(37, 99, 235, 0.1)' : 'transparent' }}>
            <input
              type="radio"
              name="analysisMode"
              value="spam"
              checked={analysisMode === 'spam'}
              onChange={(e) => setAnalysisMode(e.target.value)}
              disabled={isLoading}
            />
            <div>
              <div style={{ fontWeight: 500 }}>Spam Analysis Only (Fast)</div>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '2px' }}>
                Checks historical snapshots for spam content only
              </div>
            </div>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px', borderRadius: '8px', background: analysisMode === 'complete' ? 'rgba(37, 99, 235, 0.1)' : 'transparent' }}>
            <input
              type="radio"
              name="analysisMode"
              value="complete"
              checked={analysisMode === 'complete'}
              onChange={(e) => setAnalysisMode(e.target.value)}
              disabled={isLoading}
            />
            <div>
              <div style={{ fontWeight: 500 }}>Complete Analysis (Comprehensive)</div>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '2px' }}>
                Spam + Backlinks + Topics + Domain Metrics (DR, Trust Flow, etc.)
              </div>
            </div>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !domains.trim()}
        className="btn btn-primary"
        style={{ width: '100%', boxSizing: 'border-box' }}
      >
        {isLoading 
          ? 'Analyzing...' 
          : analysisMode === 'complete' 
            ? 'Start Complete Analysis' 
            : 'Analyze for Spam'}
      </button>
    </form>
  );
}

