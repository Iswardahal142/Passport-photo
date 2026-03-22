'use client';

import { useState, useEffect } from 'react';

interface KeyEntry {
  id: string;
  key: string;
  label: string;
  active: boolean;
  usageCount: number;
  exhausted: boolean;
  addedAt: string;
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      onLogin();
    } else {
      setError(data.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 100%)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4f8aff, #a855f7)' }}>
            <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '2rem', letterSpacing: '3px' }}
            className="text-white">ADMIN PANEL</h1>
          <p className="text-gray-500 text-sm mt-1">Passport Pro — Key Management</p>
        </div>

        {/* Form */}
        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-600 text-sm outline-none focus:border-blue-500 transition-colors"
                style={{ background: '#0f0f1a', border: '1px solid #2a2a3a' }}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••"
                required
                className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-600 text-sm outline-none focus:border-blue-500 transition-colors"
                style={{ background: '#0f0f1a', border: '1px solid #2a2a3a' }}
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg text-sm text-red-400"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" className="btn-primary mt-2" disabled={loading}>
              {loading ? 'Signing in...' : '🔐 Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-6">
            Only authorized email can access this panel
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Key Card ─────────────────────────────────────────────────────────────────
function KeyCard({ k, onDelete, onToggle, onReset }: {
  k: KeyEntry;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onReset: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const statusColor = k.exhausted ? '#ef4444' : k.active ? '#22c55e' : '#f59e0b';
  const statusLabel = k.exhausted ? 'Exhausted' : k.active ? 'Active' : 'Disabled';
  const statusBg = k.exhausted ? 'rgba(239,68,68,0.1)' : k.active ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)';

  return (
    <div className="glass-card p-5 flex flex-col gap-3 fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-white truncate">{k.label}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ color: statusColor, background: statusBg }}>
              ● {statusLabel}
            </span>
          </div>
          <p className="text-sm font-mono text-gray-400 truncate">{k.key}</p>
          <p className="text-xs text-gray-600 mt-1">
            Added {new Date(k.addedAt).toLocaleDateString()} · {k.usageCount} uses
          </p>
        </div>

        {/* Priority badge */}
        <div className="text-xs text-gray-500 shrink-0">
          {k.active && !k.exhausted && (
            <span className="px-2 py-1 rounded" style={{ background: 'rgba(79,138,255,0.1)', color: '#4f8aff' }}>
              In Queue
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {/* Toggle */}
        <button
          onClick={() => onToggle(k.id)}
          className="text-xs px-3 py-1.5 rounded-lg transition-all font-medium"
          style={{
            background: k.active && !k.exhausted ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
            color: k.active && !k.exhausted ? '#f59e0b' : '#22c55e',
            border: `1px solid ${k.active && !k.exhausted ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}`,
          }}
        >
          {k.active && !k.exhausted ? '⏸ Disable' : '▶ Enable'}
        </button>

        {/* Reset (if exhausted) */}
        {k.exhausted && (
          <button
            onClick={() => onReset(k.id)}
            className="text-xs px-3 py-1.5 rounded-lg transition-all font-medium"
            style={{
              background: 'rgba(79,138,255,0.1)',
              color: '#4f8aff',
              border: '1px solid rgba(79,138,255,0.2)',
            }}
          >
            🔄 Reset
          </button>
        )}

        {/* Delete */}
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs px-3 py-1.5 rounded-lg transition-all font-medium ml-auto"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            🗑 Delete
          </button>
        ) : (
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setConfirming(false)}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: '#1a1a24', color: '#9ca3af', border: '1px solid #2a2a3a' }}
            >
              Cancel
            </button>
            <button
              onClick={() => onDelete(k.id)}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: '#ef4444', color: 'white' }}
            >
              Confirm Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Key Form ─────────────────────────────────────────────────────────────
function AddKeyForm({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAdd = async () => {
    if (!key.trim()) { setError('Please enter an API key'); return; }
    setLoading(true);
    setError('');
    setSuccess('');

    const res = await fetch('/api/admin/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, label }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setSuccess('✅ Key added successfully!');
      setKey('');
      setLabel('');
      setTimeout(() => { setSuccess(''); setOpen(false); onAdd(); }, 1200);
    } else {
      setError(data.error || 'Failed to add key');
    }
  };

  if (!open) {
    return (
      <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => setOpen(true)}>
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Add New API Key
      </button>
    );
  }

  return (
    <div className="glass-card p-6 fade-in" style={{ border: '1px solid rgba(79,138,255,0.3)' }}>
      <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
        <span style={{ color: '#4f8aff' }}>+</span> Add Remove.bg API Key
      </h3>

      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Label (optional)</label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Account 1, Free Key #2"
            className="w-full px-4 py-2.5 rounded-lg text-white placeholder-gray-600 text-sm outline-none"
            style={{ background: '#0f0f1a', border: '1px solid #2a2a3a' }}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">API Key *</label>
          <input
            type="text"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="Paste your remove.bg API key here"
            className="w-full px-4 py-2.5 rounded-lg text-white placeholder-gray-600 text-sm font-mono outline-none"
            style={{ background: '#0f0f1a', border: '1px solid #2a2a3a' }}
          />
          <p className="text-xs text-gray-600 mt-1">
            Get free key at <a href="https://www.remove.bg/api" target="_blank" className="text-blue-400 hover:underline">remove.bg/api</a> (50 free calls/month)
          </p>
        </div>

        {error && <p className="text-sm text-red-400">⚠️ {error}</p>}
        {success && <p className="text-sm text-green-400">{success}</p>}

        <div className="flex gap-3 mt-1">
          <button className="btn-secondary flex-1" onClick={() => { setOpen(false); setError(''); setKey(''); setLabel(''); }}>
            Cancel
          </button>
          <button className="btn-primary flex-1" onClick={handleAdd} disabled={loading}>
            {loading ? 'Adding...' : 'Add Key'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [kvWarning, setKvWarning] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/keys');
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleDelete = async (id: string) => {
    await fetch('/api/admin/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchKeys();
  };

  const handleToggle = async (id: string) => {
    await fetch('/api/admin/keys', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'toggle' }),
    });
    fetchKeys();
  };

  const handleReset = async (id: string) => {
    await fetch('/api/admin/keys', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'reset' }),
    });
    fetchKeys();
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    onLogout();
  };

  const activeCount = keys.filter(k => k.active && !k.exhausted).length;
  const exhaustedCount = keys.filter(k => k.exhausted).length;
  const totalUsage = keys.reduce((s, k) => s + k.usageCount, 0);

  return (
    <div className="min-h-screen px-4 py-10"
      style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 100%)' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '2.2rem', letterSpacing: '3px' }}
              className="text-white">
              ADMIN PANEL
            </h1>
            <p className="text-gray-500 text-sm">Remove.bg API Key Manager</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="btn-secondary text-sm px-4 py-2">← App</a>
            <button onClick={handleLogout} className="btn-secondary text-sm px-4 py-2"
              style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
              Logout
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Keys', value: keys.length, color: '#4f8aff' },
            { label: 'Active', value: activeCount, color: '#22c55e' },
            { label: 'Total Uses', value: totalUsage, color: '#a855f7' },
          ].map(stat => (
            <div key={stat.label} className="glass-card p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Status banner */}
        {keys.length > 0 && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
            activeCount > 0
              ? 'text-green-400'
              : 'text-red-400'
          }`} style={{
            background: activeCount > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${activeCount > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            {activeCount > 0
              ? `✅ ${activeCount} active key${activeCount > 1 ? 's' : ''} — auto-rotation enabled. ${exhaustedCount > 0 ? `${exhaustedCount} exhausted.` : ''}`
              : '⚠️ No active keys! Add at least one API key to enable background removal.'}
          </div>
        )}

        {/* How auto-rotation works */}
        <div className="mb-6 px-4 py-3 rounded-xl text-xs text-gray-500"
          style={{ background: 'rgba(79,138,255,0.05)', border: '1px solid rgba(79,138,255,0.1)' }}>
          <p className="text-blue-400 font-semibold mb-1">🔄 Auto-Rotation Logic</p>
          Keys are used in order (top to bottom). When a key hits its limit, the app automatically switches to the next active key. Reset a key when its monthly quota refreshes.
        </div>

        {/* Keys list */}
        <div className="flex flex-col gap-3 mb-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="loader"/>
            </div>
          ) : keys.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <p className="text-4xl mb-3">🔑</p>
              <p className="text-gray-400">No API keys added yet.</p>
              <p className="text-gray-600 text-sm mt-1">Add your first Remove.bg API key below.</p>
            </div>
          ) : (
            keys.map((k, i) => (
              <div key={k.id} className="relative">
                {i === 0 && activeCount > 0 && !k.exhausted && k.active && (
                  <div className="absolute -top-2 -right-2 z-10 text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: 'linear-gradient(135deg, #4f8aff, #a855f7)', color: 'white' }}>
                    CURRENT
                  </div>
                )}
                <KeyCard
                  k={k}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                  onReset={handleReset}
                />
              </div>
            ))
          )}
        </div>

        {/* Add key form */}
        <AddKeyForm onAdd={fetchKeys} />

        {/* KV Notice */}
        <div className="mt-8 px-4 py-3 rounded-xl text-xs"
          style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', color: '#d97706' }}>
          <p className="font-semibold mb-1">⚠️ Important: Enable Vercel KV Storage</p>
          <p className="text-yellow-700">
            Keys are saved in Vercel KV. In Vercel dashboard → Storage → Create KV Database → link to your project.
            Without KV, keys will reset on each deployment.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  // Check session on mount
  useEffect(() => {
    fetch('/api/admin/keys')
      .then(r => setLoggedIn(r.ok))
      .catch(() => setLoggedIn(false));
  }, []);

  if (loggedIn === null) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: '#0a0a0f' }}>
        <div className="loader"/>
      </div>
    );
  }

  if (!loggedIn) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  }

  return <Dashboard onLogout={() => setLoggedIn(false)} />;
}
