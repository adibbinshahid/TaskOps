import { GoogleGenAI } from '@google/genai';
import type { GeminiResult, Correction } from '@/types';
import { TIMEZONE } from './constants';

let _ai: GoogleGenAI | null = null;
function getAI() {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  return _ai;
}

export async function processWithGemini(
  input: { text?: string; audioBase64?: string; mimeType?: string },
  groups: string[],
  corrections: Pick<Correction, 'field_changed' | 'old_value' | 'new_value'>[]
): Promise<GeminiResult> {
  const ai = getAI();

  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', {
    timeZone: TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let correctionsContext = '';
  if (corrections.length > 0) {
    const lines = corrections
      .slice(-20)
      .map(
        (c) =>
          `- "${c.old_value}" was corrected to "${c.new_value}" for field ${c.field_changed}`
      );
    correctionsContext = `\nNote: user has previously corrected similar entries. Past corrections:\n${lines.join('\n')}\n`;
  }

  const systemInstruction = `You are the AI processing layer for a personal task capture system.
Input is a raw note from the user, written in ANY language (English, Bengali, or mixed).

Today's date is: ${currentDate} (${TIMEZONE})
Existing groups (you may ONLY classify into one of these — NEVER invent a new group): ${groups.join(', ')}
${correctionsContext}
Your job — return ONLY valid JSON, no markdown, no preamble:
{
  "refined_entry": string,
  "group": string,
  "assigned_date": string,
  "reminder_time": string,
  "confidence": number,
  "reasoning": string,
  "is_recurring": boolean,
  "recurring_pattern": "daily"|"weekly"|"monthly"|null
}

Rules:
- refined_entry: professional clear ENGLISH version of the note regardless of input language
- group: must exactly match one name from the groups list
- assigned_date: ISO date YYYY-MM-DD. If relative ("next week", "month end", "first week of July"), decide a specific concrete date — NEVER leave null
- reminder_time: ISO datetime string, default 09:00 AM on assigned_date unless context implies otherwise
- confidence: 0-100, how confident in group + date classification
- is_recurring: true if phrasing implies repetition ("every Monday", "weekly", "monthly review")
- recurring_pattern: "daily"|"weekly"|"monthly"|null`;

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  if (input.audioBase64 && input.mimeType) {
    parts.push({ inlineData: { mimeType: input.mimeType, data: input.audioBase64 } });
    parts.push({ text: 'Process this voice note according to your instructions.' });
  } else {
    parts.push({ text: input.text! });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts }],
    config: { systemInstruction },
  });

  const rawText = response.text ?? '';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Gemini non-JSON response: ${rawText.slice(0, 200)}`);

  const parsed = JSON.parse(jsonMatch[0]) as GeminiResult;

  // Validate group exists
  if (!groups.includes(parsed.group)) {
    parsed.group = groups[0] ?? 'To Do';
    parsed.confidence = Math.min(parsed.confidence, 30);
  }

  return parsed;
}
