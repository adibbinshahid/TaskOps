export type TaskStatus = 'processing' | 'active' | 'needs_review' | 'completed' | 'deleted';
export type TaskSource = 'web' | 'telegram_text' | 'telegram_voice' | 'pwa_voice';
export type RecurringPattern = 'daily' | 'weekly' | 'monthly';
export type ActivityAction =
  | 'created'
  | 'ai_classified'
  | 'ai_scheduled'
  | 'edited'
  | 'moved'
  | 'reminded'
  | 'completed'
  | 'deleted'
  | 'undone';
export type ActivityActor = 'system' | 'user' | 'ai';

export interface Group {
  id: string;
  name: string;
  created_at: string;
  is_default: boolean;
}

export interface Task {
  id: string;
  original_entry: string;
  refined_entry: string | null;
  group_id: string | null;
  assigned_date: string | null;
  reminder_time: string | null;
  created_at: string;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  status: TaskStatus;
  source: TaskSource;
  is_recurring: boolean;
  recurring_pattern: RecurringPattern | null;
  recurring_parent_id: string | null;
  raw_audio_url: string | null;
  groups?: Group | null;
}

export interface ActivityLog {
  id: string;
  task_id: string | null;
  action: ActivityAction;
  actor: ActivityActor;
  meta: Record<string, unknown> | null;
  created_at: string;
  tasks?: Pick<Task, 'id' | 'refined_entry' | 'original_entry'> | null;
}

export interface Correction {
  id: string;
  task_id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface GeminiResult {
  refined_entry: string;
  group: string;
  assigned_date: string;
  reminder_time: string;
  confidence: number;
  reasoning: string;
  is_recurring: boolean;
  recurring_pattern: RecurringPattern | null;
}
