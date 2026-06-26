import { NextRequest, NextResponse } from 'next/server';
import { processEntry } from '@/lib/process-entry';
import { sendTelegramMessage } from '@/lib/telegram';
import { downloadTelegramFile } from '@/lib/telegram';
import { createServerClient } from '@/lib/supabase-server';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { TIMEZONE } from '@/lib/constants';

interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  text?: string;
  voice?: { file_id: string; duration: number; mime_type?: string };
  entities?: Array<{ type: string; offset: number; length: number }>;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

const AUTHORIZED_CHAT_ID = parseInt(process.env.TELEGRAM_CHAT_ID ?? '0', 10);

export async function POST(request: NextRequest) {
  try {
    const update = await request.json() as TelegramUpdate;
    const message = update.message;

    if (!message) return NextResponse.json({ ok: true });

    // Silently ignore unauthorized chats
    if (message.chat.id !== AUTHORIZED_CHAT_ID) {
      return NextResponse.json({ ok: true });
    }

    // Handle commands
    if (message.text?.startsWith('/')) {
      await handleCommand(message.text, message.chat.id);
      return NextResponse.json({ ok: true });
    }

    // Handle voice note
    if (message.voice) {
      const { data, mimeType } = await downloadTelegramFile(message.voice.file_id);
      await processEntry({ audioBase64: data, mimeType }, 'telegram_voice');
      return NextResponse.json({ ok: true });
    }

    // Handle text message
    if (message.text?.trim()) {
      await processEntry({ text: message.text }, 'telegram_text');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

async function handleCommand(text: string, chatId: number) {
  const cmd = text.split(' ')[0].toLowerCase();
  const db = createServerClient();

  if (cmd === '/today') {
    const today = format(toZonedTime(new Date(), TIMEZONE), 'yyyy-MM-dd');
    const { data: tasks } = await db
      .from('tasks')
      .select('*, groups(name)')
      .eq('assigned_date', today)
      .neq('status', 'deleted')
      .neq('status', 'completed')
      .order('created_at');

    if (!tasks || tasks.length === 0) {
      await sendTelegramMessage(`📋 No tasks for today (${today}).`);
      return;
    }

    const lines = tasks.map((t: { refined_entry?: string; original_entry: string; groups?: { name: string } | null }) =>
      `• ${t.refined_entry ?? t.original_entry}${t.groups ? ` <i>[${t.groups.name}]</i>` : ''}`
    );
    await sendTelegramMessage(`📋 <b>Today — ${today}</b>\n\n${lines.join('\n')}`);
  }

  if (cmd === '/review') {
    const { data: tasks } = await db
      .from('tasks')
      .select('refined_entry, original_entry')
      .eq('status', 'needs_review')
      .order('created_at', { ascending: false })
      .limit(10);

    const count = tasks?.length ?? 0;
    if (count === 0) {
      await sendTelegramMessage('✅ No tasks need review.');
      return;
    }

    const lines = (tasks ?? []).map((t: { refined_entry?: string; original_entry: string }) =>
      `• ${t.refined_entry ?? t.original_entry}`
    );
    await sendTelegramMessage(
      `⚠️ <b>Needs Review (${count})</b>\n\n${lines.join('\n')}\n\nOpen TaskOps to review.`
    );
  }
}

// Telegram webhook must return 200 even for GET (health check)
export async function GET() {
  return NextResponse.json({ ok: true, service: 'TaskOps Telegram Webhook' });
}
