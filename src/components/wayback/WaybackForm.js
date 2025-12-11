import { useState } from 'react';

export default function WaybackForm({ onTest, isLoading }) {
  const [target, setTarget] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!target.trim()) {
      return;
    }
    onTest(target.trim());
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">
          Target URL or Domain
        </label>
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="example.com or https://example.com/page"
          className="form-input"
          required
          disabled={isLoading}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !target.trim()}
        className="btn btn-primary"
        style={{ width: '100%' }}
      >
        {isLoading ? '🔄 Testing...' : '🔍 Test Wayback Machine'}
      </button>
    </form>
  );
}

