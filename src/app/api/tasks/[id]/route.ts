import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const db = createServerClient();
  const { data, error } = await db
    .from('tasks')
    .select('*, groups(id, name)')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const db = createServerClient();
  const body = await request.json() as Record<string, unknown>;
  const { field, value } = body as { field: string; value: unknown };

  // Fetch current task for undo meta
  const { data: current } = await db
    .from('tasks')
    .select('*')
    .eq('id', params.id)
    .single();

  const oldValue = current?.[field as keyof typeof current];

  const { data, error } = await db
    .from('tasks')
    .update({ [field]: value })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log edit
  await db.from('activity_log').insert({
    task_id: params.id,
    action: field === 'assigned_date' ? 'moved' : 'edited',
    actor: 'user',
    meta: { field, old_value: oldValue, new_value: value },
  });

  // Write correction for AI learning
  if (['group_id', 'assigned_date', 'refined_entry'].includes(field)) {
    await db.from('corrections').insert({
      task_id: params.id,
      field_changed: field,
      old_value: String(oldValue ?? ''),
      new_value: String(value ?? ''),
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const db = createServerClient();

  const { data: current } = await db.from('tasks').select('*').eq('id', params.id).single();

  await db.from('tasks').update({ status: 'deleted' }).eq('id', params.id);

  await db.from('activity_log').insert({
    task_id: params.id,
    action: 'deleted',
    actor: 'user',
    meta: { previous_status: current?.status },
  });

  return NextResponse.json({ ok: true });
}
