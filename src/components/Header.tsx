import { Activity, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onRefresh: () => void;
  loading: boolean;
}

export function Header({ onRefresh, loading }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <Activity size={28} />
        <div>
          <h1>AI Usage Dashboard</h1>
          <p className="subtitle">Team usage across Claude, ChatGPT, Gemini, Higgsfield &amp; Weavy</p>
        </div>
      </div>
      <button
        className="btn btn-secondary"
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw size={16} className={loading ? 'spin' : ''} />
        {loading ? 'Loading...' : 'Refresh'}
      </button>
    </header>
  );
}
