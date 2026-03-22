import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';
import { getApiKeys, saveApiKeys, ApiKeyEntry } from '@/lib/keyStore';

function checkAuth() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return !!verifySessionToken(token);
}

// GET – list all keys (masked)
export async function GET() {
  if (!checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const keys = await getApiKeys();
  // Mask keys for display: show first 6 and last 4 chars
  const masked = keys.map(k => ({
    ...k,
    key: k.key.length > 10
      ? k.key.slice(0, 6) + '••••••••' + k.key.slice(-4)
      : '••••••••••••',
  }));

  return NextResponse.json({ keys: masked });
}

// POST – add new key
export async function POST(request: NextRequest) {
  if (!checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { key, label } = await request.json();
  if (!key || key.trim().length < 8) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 400 });
  }

  const keys = await getApiKeys();

  // Don't add duplicates
  if (keys.some(k => k.key === key.trim())) {
    return NextResponse.json({ error: 'This key already exists' }, { status: 409 });
  }

  const newKey: ApiKeyEntry = {
    id: `key_${Date.now()}`,
    key: key.trim(),
    label: label?.trim() || `Key #${keys.length + 1}`,
    active: true,
    usageCount: 0,
    exhausted: false,
    addedAt: new Date().toISOString(),
  };

  await saveApiKeys([...keys, newKey]);
  return NextResponse.json({ success: true, key: { ...newKey, key: '••••••••' } });
}

// DELETE – remove a key
export async function DELETE(request: NextRequest) {
  if (!checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  const keys = await getApiKeys();
  const updated = keys.filter(k => k.id !== id);
  await saveApiKeys(updated);
  return NextResponse.json({ success: true });
}

// PATCH – toggle active / reset exhausted
export async function PATCH(request: NextRequest) {
  if (!checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, action } = await request.json();
  const keys = await getApiKeys();

  const updated = keys.map(k => {
    if (k.id !== id) return k;
    if (action === 'toggle') return { ...k, active: !k.active };
    if (action === 'reset') return { ...k, exhausted: false, active: true, usageCount: 0 };
    return k;
  });

  await saveApiKeys(updated);
  return NextResponse.json({ success: true });
}
