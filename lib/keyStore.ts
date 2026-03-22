// lib/keyStore.ts
// Stores API keys in Vercel KV (Redis-like storage)
// Falls back to env variable if KV not configured

const KV_KEY = 'removebg_api_keys';

export interface ApiKeyEntry {
  id: string;
  key: string;
  label: string;
  active: boolean;
  usageCount: number;
  exhausted: boolean;
  addedAt: string;
}

// ── Read all keys ──────────────────────────────────────────────────────────
export async function getApiKeys(): Promise<ApiKeyEntry[]> {
  try {
    // Try Vercel KV first
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      const data = await kv.get<ApiKeyEntry[]>(KV_KEY);
      if (data) return data;
    }
  } catch (e) {
    console.error('KV read error:', e);
  }

  // Fallback: env variable as single key
  const envKey = process.env.REMOVEBG_API_KEY;
  if (envKey) {
    return [{
      id: 'env-default',
      key: envKey,
      label: 'Default (from env)',
      active: true,
      usageCount: 0,
      exhausted: false,
      addedAt: new Date().toISOString(),
    }];
  }

  return [];
}

// ── Save all keys ──────────────────────────────────────────────────────────
export async function saveApiKeys(keys: ApiKeyEntry[]): Promise<void> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import('@vercel/kv');
    await kv.set(KV_KEY, keys);
  }
  // If no KV, we can't persist — admin panel will show warning
}

// ── Get next active (non-exhausted) key ────────────────────────────────────
export async function getActiveKey(): Promise<ApiKeyEntry | null> {
  const keys = await getApiKeys();
  return keys.find(k => k.active && !k.exhausted) || null;
}

// ── Mark a key as exhausted (quota hit) ───────────────────────────────────
export async function markKeyExhausted(id: string): Promise<void> {
  const keys = await getApiKeys();
  const updated = keys.map(k =>
    k.id === id ? { ...k, exhausted: true, active: false } : k
  );
  await saveApiKeys(updated);
}

// ── Increment usage count ──────────────────────────────────────────────────
export async function incrementUsage(id: string): Promise<void> {
  const keys = await getApiKeys();
  const updated = keys.map(k =>
    k.id === id ? { ...k, usageCount: k.usageCount + 1 } : k
  );
  await saveApiKeys(updated);
}
