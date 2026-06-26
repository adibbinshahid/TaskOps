import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { sendTelegramMessage } from '@/lib/telegram';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { TIMEZONE } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runDigest();
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runDigest();
}

async function runDigest() {
  const db = createServerClient();
  const now = new Date();
  const today = format(toZonedTime(now, TIMEZONE), 'yyyy-MM-dd');

  // 1. Spawn next occurrences of due recurring tasks
  const { data: recurringTasks } = await db
    .from('tasks')
    .select('*')
    .eq('is_recurring', true)
    .eq('status', 'completed')
    .not('recurring_pattern', 'is', null);

  for (const task of recurringTasks ?? []) {
    const nextDate = getNextOccurrence(task.assigned_date, task.recurring_pattern, today);
    if (nextDate) {
      const { data: existing } = await db
        .from('tasks')
        .select('id')
        .eq('recurring_parent_id', task.id)
        .eq('assigned_date', nextDate)
        .single();

      if (!existing) {
        await db.from('tasks').insert({
          original_entry: task.original_entry,
          refined_entry: task.refined_entry,
          group_id: task.group_id,
          assigned_date: nextDate,
          reminder_time: task.reminder_time
            ? nextDate + task.reminder_time.slice(10)
            : null,
          ai_confidence: task.ai_confidence,
          ai_reasoning: task.ai_reasoning,
          status: 'active',
          source: task.source,
          is_recurring: true,
          recurring_pattern: task.recurring_pattern,
          recurring_parent_id: task.id,
        });
      }
    }
  }

  // 2. Per-task reminders (due in next 5 minutes, not yet reminded)
  const reminderCutoff = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  const { data: dueReminders } = await db
    .from('tasks')
    .select('*, groups(name)')
    .eq('status', 'active')
    .lte('reminder_time', reminderCutoff)
    .gte('reminder_time', now.toISOString());

  for (const task of dueReminders ?? []) {
    const entry = task.refined_entry ?? task.original_entry;
    const group = task.groups?.name ?? '';
    await sendTelegramMessage(
      `⏰ <b>Reminder</b>\n\n${entry}${group ? `\n📁 ${group}` : ''}`
    );
    await db.from('activity_log').insert({
      task_id: task.id,
      action: 'reminded',
      actor: 'system',
      meta: { reminder_time: task.reminder_time },
    });
  }

  // 3. Build daily digest
  const { data: todayTasks } = await db
    .from('tasks')
    .select('*, groups(name)')
    .eq('assigned_date', today)
    .neq('status', 'deleted')
    .neq('status', 'completed')
    .order('created_at');

  const { count: needsReviewCount } = await db
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'needs_review');

  const yesterday = format(addDays(toZonedTime(now, TIMEZONE), -1), 'yyyy-MM-dd');
  const { count: overdueCount } = await db
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .lt('assigned_date', today)
    .gt('assigned_date', yesterday)
    .eq('status', 'active');

  // Group tasks by group name
  const grouped: Record<string, string[]> = {};
  for (const task of todayTasks ?? []) {
    const groupName = (task.groups as { name: string } | null)?.name ?? 'Ungrouped';
    if (!grouped[groupName]) grouped[groupName] = [];
    grouped[groupName].push(task.refined_entry ?? task.original_entry);
  }

  const sections = Object.entries(grouped)
    .map(([name, entries]) => `<b>${name}</b>\n${entries.map((e) => `• ${e}`).join('\n')}`)
    .join('\n\n');

  const flags: string[] = [];
  if ((needsReviewCount ?? 0) > 0) flags.push(`⚠️ Needs Review (${needsReviewCount})`);
  if ((overdueCount ?? 0) > 0) flags.push(`🔴 Overdue (${overdueCount})`);

  const totalToday = todayTasks?.length ?? 0;
  const digestText = [
    `🗓 <b>Good morning — today's tasks (${today})</b>`,
    '',
    totalToday === 0 ? 'No tasks scheduled for today.' : sections,
    flags.length > 0 ? '\n' + flags.join('\n') : '',
  ]
    .filter((l) => l !== undefined)
    .join('\n');

  await sendTelegramMessage(digestText);

  return NextResponse.json({
    ok: true,
    today: totalToday,
    reminders: dueReminders?.length ?? 0,
    recurring_spawned: recurringTasks?.length ?? 0,
  });
}

function getNextOccurrence(
  lastDate: string | null,
  pattern: string | null,
  today: string
): string | null {
  if (!lastDate || !pattern) return null;
  const base = new Date(lastDate);
  let next: Date;

  switch (pattern) {
    case 'daily':
      next = addDays(base, 1);
      break;
    case 'weekly':
      next = addWeeks(base, 1);
      break;
    case 'monthly':
      next = addMonths(base, 1);
      break;
    default:
      return null;
  }

  const nextStr = format(next, 'yyyy-MM-dd');
  return nextStr >= today ? nextStr : null;
}
