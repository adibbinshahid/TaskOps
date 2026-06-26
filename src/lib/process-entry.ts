import { createServerClient } from './supabase-server';
import { processWithGemini } from './gemini';
import { sendTelegramMessage } from './telegram';
import type { TaskSource } from '@/types';
import { CONFIDENCE_THRESHOLD } from './constants';

export async function processEntry(
  input: { text?: string; audioBase64?: string; mimeType?: string },
  source: TaskSource
): Promise<{ taskId: string }> {
  const db = createServerClient();

  const originalEntry = input.text?.trim() || '[voice note — transcribing]';

  const { data: task, error } = await db
    .from('tasks')
    .insert({ original_entry: originalEntry, status: 'processing', source })
    .select()
    .single();

  if (error || !task) throw new Error(error?.message ?? 'Insert failed');

  await db.from('activity_log').insert({
    task_id: task.id,
    action: 'created',
    actor: 'user',
    meta: { source },
  });

  // Fire-and-forget async processing
  processAsync(task.id, input, source).catch((err) =>
    console.error('processAsync unhandled:', err)
  );

  return { taskId: task.id };
}

async function processAsync(
  taskId: string,
  input: { text?: string; audioBase64?: string; mimeType?: string },
  source: TaskSource
) {
  const db = createServerClient();

  try {
    const [{ data: groups }, { data: corrections }] = await Promise.all([
      db.from('groups').select('name').order('name'),
      db
        .from('corrections')
        .select('field_changed, old_value, new_value')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const groupNames = (groups ?? []).map((g: { name: string }) => g.name);

    const result = await processWithGemini(input, groupNames, corrections ?? []);

    const { data: group } = await db
      .from('groups')
      .select('id')
      .eq('name', result.group)
      .single();

    const status = result.confidence >= CONFIDENCE_THRESHOLD ? 'active' : 'needs_review';

    const updates: Record<string, unknown> = {
      refined_entry: result.refined_entry,
      group_id: group?.id ?? null,
      assigned_date: result.assigned_date,
      reminder_time: result.reminder_time,
      ai_confidence: result.confidence,
      ai_reasoning: result.reasoning,
      status,
      is_recurring: result.is_recurring,
      recurring_pattern: result.recurring_pattern ?? null,
    };

    // If audio input, update original_entry with transcription result
    if (input.audioBase64) {
      updates.original_entry = result.refined_entry;
    }

    await db.from('tasks').update(updates).eq('id', taskId);

    await db.from('activity_log').insert([
      {
        task_id: taskId,
        action: 'ai_classified',
        actor: 'ai',
        meta: {
          group: result.group,
          confidence: result.confidence,
          reasoning: result.reasoning,
        },
      },
      {
        task_id: taskId,
        action: 'ai_scheduled',
        actor: 'ai',
        meta: {
          assigned_date: result.assigned_date,
          reminder_time: result.reminder_time,
        },
      },
    ]);

    if (source === 'telegram_text' || source === 'telegram_voice') {
      const statusNote = status === 'needs_review' ? '\n⚠️ Low confidence — check Needs Review' : '';
      await sendTelegramMessage(
        `✅ <b>Task saved</b>\n\n${result.refined_entry}\n📁 <i>${result.group}</i>\n📅 ${result.assigned_date}${statusNote}`
      );
    }
  } catch (err) {
    console.error('Gemini processing failed:', err);
    await db.from('tasks').update({ status: 'needs_review' }).eq('id', taskId);
    await db.from('activity_log').insert({
      task_id: taskId,
      action: 'ai_classified',
      actor: 'ai',
      meta: { error: String(err) },
    });
    if (source === 'telegram_text' || source === 'telegram_voice') {
      await sendTelegramMessage(`⚠️ Task saved but AI processing failed. Check Needs Review.`);
    }
  }
}
