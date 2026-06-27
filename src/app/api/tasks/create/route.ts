import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createServerClient } from '@/lib/supabase-server';
import { processWithGemini } from '@/lib/gemini';
import { sendTelegramMessage } from '@/lib/telegram';
import { CONFIDENCE_THRESHOLD } from '@/lib/constants';
import type { TaskSource } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      text?: string;
      audioBase64?: string;
      mimeType?: string;
      source?: TaskSource;
      assigned_date?: string;
    };

    if (!body.text?.trim() && !body.audioBase64) {
      return NextResponse.json({ error: 'text or audioBase64 required' }, { status: 400 });
    }

    const db = createServerClient();
    const source: TaskSource = body.source ?? 'web';
    const originalEntry = body.text?.trim() || '[voice note — transcribing]';

    // Set date immediately so the task is visible in Week/Month views during processing.
    // AI may override this with a better date in processAsync.
    const today = new Date().toISOString().slice(0, 10);
    const initialDate = body.assigned_date ?? today;

    const { data: task, error } = await db
      .from('tasks')
      .insert({ original_entry: originalEntry, status: 'processing', source, assigned_date: initialDate })
      .select()
      .single();

    if (error || !task) throw new Error(error?.message ?? 'Insert failed');

    await db.from('activity_log').insert({
      task_id: task.id,
      action: 'created',
      actor: 'user',
      meta: { source },
    });

    // waitUntil keeps Vercel function alive after response is sent
    waitUntil(processAsync(task.id, { text: body.text, audioBase64: body.audioBase64, mimeType: body.mimeType }, source, body.assigned_date));

    return NextResponse.json({ taskId: task.id });
  } catch (err) {
    console.error('POST /api/tasks/create:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function processAsync(
  taskId: string,
  input: { text?: string; audioBase64?: string; mimeType?: string },
  source: TaskSource,
  userDate?: string
) {
  const db = createServerClient();
  try {
    const [{ data: groups }, { data: corrections }] = await Promise.all([
      db.from('groups').select('name').order('name'),
      db.from('corrections').select('field_changed, old_value, new_value').order('created_at', { ascending: false }).limit(20),
    ]);

    const groupNames = (groups ?? []).map((g: { name: string }) => g.name);
    const result = await processWithGemini(input, groupNames, corrections ?? []);

    const { data: group } = await db.from('groups').select('id').eq('name', result.group).single();
    const status = result.confidence >= CONFIDENCE_THRESHOLD ? 'active' : 'needs_review';

    const updates: Record<string, unknown> = {
      refined_entry: result.refined_entry,
      group_id: group?.id ?? null,
      assigned_date: userDate ?? result.assigned_date,
      reminder_time: result.reminder_time,
      ai_confidence: result.confidence,
      ai_reasoning: result.reasoning,
      status,
      is_recurring: result.is_recurring,
      recurring_pattern: result.recurring_pattern ?? null,
    };
    if (input.audioBase64) updates.original_entry = result.refined_entry;

    await db.from('tasks').update(updates).eq('id', taskId);

    await db.from('activity_log').insert([
      { task_id: taskId, action: 'ai_classified', actor: 'ai', meta: { group: result.group, confidence: result.confidence, reasoning: result.reasoning } },
      { task_id: taskId, action: 'ai_scheduled', actor: 'ai', meta: { assigned_date: result.assigned_date, reminder_time: result.reminder_time } },
    ]);

    if (source === 'telegram_text' || source === 'telegram_voice') {
      const statusNote = status === 'needs_review' ? '\n⚠️ Low confidence — check Needs Review' : '';
      await sendTelegramMessage(`✅ <b>Task saved</b>\n\n${result.refined_entry}\n📁 <i>${result.group}</i>\n📅 ${result.assigned_date}${statusNote}`);
    }
  } catch (err) {
    console.error('Gemini processing failed:', err);
    await db.from('tasks').update({ status: 'needs_review' }).eq('id', taskId);
    await db.from('activity_log').insert({ task_id: taskId, action: 'ai_classified', actor: 'ai', meta: { error: String(err) } });
    if (source === 'telegram_text' || source === 'telegram_voice') {
      await sendTelegramMessage(`⚠️ Task saved but AI processing failed. Check Needs Review.`);
    }
  }
}
