const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendTelegramMessage(text: string): Promise<void> {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      console.error('Telegram send failed:', await res.text());
    }
  } catch (err) {
    console.error('Telegram error:', err);
  }
}

export async function downloadTelegramFile(
  fileId: string
): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(`${TELEGRAM_API}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const json = (await res.json()) as { ok: boolean; result: { file_path: string } };
  if (!json.ok) throw new Error('Failed to get Telegram file path');

  const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${json.result.file_path}`;
  const fileRes = await fetch(fileUrl);
  const buffer = await fileRes.arrayBuffer();

  return {
    data: Buffer.from(buffer).toString('base64'),
    mimeType: 'audio/ogg',
  };
}
