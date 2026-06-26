import { NextRequest, NextResponse } from 'next/server';
import { processEntry } from '@/lib/process-entry';
import type { TaskSource } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      text?: string;
      audioBase64?: string;
      mimeType?: string;
      source?: TaskSource;
    };

    if (!body.text?.trim() && !body.audioBase64) {
      return NextResponse.json({ error: 'text or audioBase64 required' }, { status: 400 });
    }

    const source: TaskSource = body.source ?? 'web';
    const result = await processEntry(
      { text: body.text, audioBase64: body.audioBase64, mimeType: body.mimeType },
      source
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/tasks/create:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
