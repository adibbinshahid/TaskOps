import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { sendTelegramMessage } from '@/lib/telegram';

export async function GET(request: NextRequest) {
  return handleReminders(request);
}

export async function POST(request: NextRequest) {
  return handleReminders(request);
}

async function handleReminders(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServerClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  const { data: tasks, error } = await db
    .from('tasks')
    .select('*, groups(name)')
    .eq('status', 'active')
    .lte('reminder_time', windowEnd)
    .gte('reminder_time', now.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Check which tasks haven't been reminded yet
  const remindedIds: string[] = [];
  for (const task of tasks ?? []) {
    const { data: alreadyReminded } = await db
      .from('activity_log')
      .select('id')
      .eq('task_id', task.id)
      .eq('action', 'reminded')
      .single();

    if (alreadyReminded) continue;

    const entry = task.refined_entry ?? task.original_entry;
    const groupName = (task.groups as { name: string } | null)?.name;

    await sendTelegramMessage(
      `⏰ <b>Task Reminder</b>\n\n${entry}${groupName ? `\n📁 ${groupName}` : ''}\n📅 ${task.assigned_date}`
    );

    await db.from('activity_log').insert({
      task_id: task.id,
      action: 'reminded',
      actor: 'system',
      meta: { reminder_time: task.reminder_time },
    });

    remindedIds.push(task.id);
  }

  return NextResponse.json({ ok: true, reminded: remindedIds.length });
}
