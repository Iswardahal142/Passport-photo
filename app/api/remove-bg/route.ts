import { NextRequest, NextResponse } from 'next/server';
import { getActiveKey, markKeyExhausted, incrementUsage } from '@/lib/keyStore';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image_file') as File;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const keyEntry = await getActiveKey();

    if (!keyEntry) {
      return NextResponse.json(
        { error: 'No active API keys available. Please add keys in admin panel.' },
        { status: 503 }
      );
    }

    const removeBgForm = new FormData();
    removeBgForm.append('image_file', imageFile);
    removeBgForm.append('size', 'auto');

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': keyEntry.key },
      body: removeBgForm,
    });

    if (response.status === 402 || response.status === 429) {
      await markKeyExhausted(keyEntry.id);
      const nextKey = await getActiveKey();
      if (!nextKey) {
        return NextResponse.json(
          { error: 'All API keys have reached their limit. Add more keys in admin panel.' },
          { status: 503 }
        );
      }

      const retryForm = new FormData();
      retryForm.append('image_file', imageFile);
      retryForm.append('size', 'auto');

      const retryRes = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': nextKey.key },
        body: retryForm,
      });

      if (!retryRes.ok) {
        return NextResponse.json({ error: 'Background removal failed.' }, { status: retryRes.status });
      }

      await incrementUsage(nextKey.id);
      const buf = await retryRes.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      return NextResponse.json({ result: `data:image/png;base64,${b64}`, keyUsed: nextKey.label });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Remove.bg error:', errorText);
      return NextResponse.json(
        { error: 'Background removal failed. Check your API key.' },
        { status: response.status }
      );
    }

    await incrementUsage(keyEntry.id);
    const imageBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');
    return NextResponse.json({ result: `data:image/png;base64,${base64}`, keyUsed: keyEntry.label });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
